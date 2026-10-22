/* Koldingbräu – gemeinsamer Kern für alle Seiten
   Anmeldung, Konto, Verwaltung, Menü, Seitenblatt und Hilfsfunktionen.
   Jede Seite meldet sich mit KB.seite = { start, chrome, laden } an; der Kern ruft sie nach der Anmeldung auf.
   Rechte werden in der Datenbank durchgesetzt; die Oberfläche blendet nur aus, was man nicht darf. */
(function () {
"use strict";

const CONFIG = {
  url: "https://ysmnvtuxckiflvvfxxiy.supabase.co",
  key: "sb_publishable_bi4uUX0fOozKCCZPzSbwAA_kPhMe6CX", // öffentlicher Schlüssel, darf im Quelltext stehen
};
const ROLLEN = {admin:"Admin", braumeister:"Braumeister"};

const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state = { session: null, profile: null, people: [] };
const isBM = () => !!state.profile && (state.profile.rolle === "admin" || state.profile.rolle === "braumeister");
const isAdmin = () => !!state.profile && state.profile.rolle === "admin";
const siteUrl = () => location.origin + location.pathname.replace(/[^/]*$/, "");

// Art des Links, mit dem die Seite geöffnet wurde (Einladung, Passwort vergessen) – vor dem Start des Clients merken
const linkInfo = (() => {
  const h = new URLSearchParams(location.hash.replace(/^#/, ""));
  return { type: h.get("type"), error: h.get("error_description") };
})();

let sb = null;

/* --- Helfer --- */
function fmtDate(iso){if(!iso)return"–";const [,m,d]=iso.split("-");return `${+d}.${+m}.`;}
function fmtDateLong(iso){if(!iso)return"";const [y,m,d]=iso.split("-");return `${+d}.${+m}.${y}`;}
function fmtDateTime(ts){if(!ts)return"";const d=new Date(ts);return d.toLocaleDateString("de-DE")+", "+d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})+" Uhr";}
function fmtZahl(v,stellen=1){return v==null||v===""||isNaN(+v)?"–":(+v).toLocaleString("de-DE",{minimumFractionDigits:stellen,maximumFractionDigits:stellen});}
function personName(id){const p=state.people.find(x=>x.id===id);return p?p.name:"";}
function todayIso(){const t=new Date();return`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;}
function toast(t){const el=$("#toast");el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2600);}
function notice(t){const n=$("#notice");if(!n)return;n.hidden=!t;n.textContent=t||"";}
function lsGet(k){try{return localStorage.getItem(k);}catch(_){return null;}}
function lsSet(k,v){try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v);}catch(_){}}

/* --- Seitenblatt --- */
let onClose=null;
function openSheet(){$("#sheet").hidden=false;$("#scrim").hidden=false;document.body.style.overflow="hidden";}
function closeSheet(){$("#sheet").hidden=true;$("#scrim").hidden=true;document.body.style.overflow="";const f=onClose;onClose=null;if(f)f();}
function sheet(titleText,body,foot,opts){$("#sheetTitle").textContent=titleText;$("#sheetBody").innerHTML=body;$("#sheetFoot").innerHTML=foot||"";onClose=(opts&&opts.onClose)||null;openSheet();$("#sheetBody").scrollTop=0;}
function kv(pairs){const p=pairs.filter(([,v])=>v!=null&&v!=="");if(!p.length)return"";return`<dl class="kv">${p.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;}
function sec(h,inner){return inner?`<section class="sec"><h3>${esc(h)}</h3>${inner}</section>`:"";}

function fehlertext(e){
  const m=(e&&(e.message||e.error_description||""))+"";
  const code=(e&&e.code)||"";
  if(code==="P0001"||code==="P0002")return m;               // eigene, schon deutsche Meldungen der Datenbank
  if(/row-level security|permission denied|42501/i.test(m+code))return"Dafür fehlt dir die Berechtigung.";
  if(/duplicate key|23505/i.test(m+code))return"Diesen Eintrag gibt es schon.";
  if(/23503|foreign key/i.test(m+code))return"Das geht nicht, weil der Eintrag noch verwendet wird.";
  if(/Invalid login credentials/i.test(m))return"E-Mail oder Passwort stimmen nicht.";
  if(/Email not confirmed/i.test(m))return"Die E-Mail-Adresse ist noch nicht bestätigt.";
  if(/Password should be at least|weak/i.test(m))return"Das Passwort ist zu kurz oder zu einfach.";
  if(/same as the old|different from the old/i.test(m))return"Das neue Passwort muss sich vom alten unterscheiden.";
  if(/rate limit|too many/i.test(m))return"Zu viele Versuche. Bitte in ein paar Minuten noch einmal.";
  if(/fetch|network/i.test(m))return"Keine Verbindung. Bitte Internetverbindung prüfen.";
  return"Das hat nicht geklappt. Bitte gleich noch einmal versuchen.";
}

/* --- Kopfzeile je nach Rolle --- */
function renderChrome(){
  const inn=!!state.session, bm=isBM(), adm=isAdmin();
  $("#loginBtn").hidden=inn;
  $("#adminBtn").hidden=!adm;
  const who=$("#accountBtn");
  if(inn&&state.profile){who.hidden=false;who.innerHTML=`<b>${esc(state.profile.name||state.profile.email||"Mein Konto")}</b>${state.profile.rolle?`<span class="role ${state.profile.rolle}">${esc(ROLLEN[state.profile.rolle])}</span>`:""}`;}
  else who.hidden=true;
  if(inn&&state.profile&&!bm)notice("Dein Konto hat noch keine Freigabe als Braumeister. Bitte wende dich an den Admin.");
  if(KB.seite&&KB.seite.chrome)KB.seite.chrome();
}
function markMenu(){
  const s=document.body.dataset.seite;
  document.querySelectorAll(".menu a[data-seite]").forEach(a=>{if(a.dataset.seite===s)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
}

/* --- Hell/Dunkel-Schalter: gilt seitenübergreifend, Wahl wird in localStorage gemerkt; ohne
   eigene Wahl folgt die Seite weiter der Systemeinstellung (siehe core/base.css). --- */
function aktuellesTheme(){
  const t=document.documentElement.getAttribute("data-theme");
  if(t)return t;
  return window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
}
function themeKnopfZeichnen(){
  const btn=$("#themeBtn"); if(!btn)return;
  btn.textContent=aktuellesTheme()==="dark"?"☀️":"🌙";
}
function themeUmschalten(){
  const neu=aktuellesTheme()==="dark"?"light":"dark";
  document.documentElement.setAttribute("data-theme",neu);
  lsSet("kb_theme",neu);
  themeKnopfZeichnen();
}

/* --- Anmelden, Passwort vergessen, Passwort festlegen --- */
function openLogin(prefill){
  sheet("Anmelden",`<form id="loginForm" class="stack" novalidate>
      <p class="hint">Nur für Braumeister von Koldingbräu. Neue Zugänge gibt es per Einladung.</p>
      <label class="f" for="l_email">E-Mail<input id="l_email" type="email" autocomplete="username" required value="${esc(prefill||"")}"></label>
      <label class="f" for="l_pw">Passwort<input id="l_pw" type="password" autocomplete="current-password" required></label>
      <button type="button" class="linkbtn" id="forgotBtn">Passwort vergessen?</button>
      <span class="err" id="loginErr"></span>
    </form>`,
    `<span class="spacer"></span><button class="btn" id="cancelLogin">Abbrechen</button><button class="btn primary" id="doLogin" form="loginForm" type="submit">Anmelden</button>`);
  $("#cancelLogin").onclick=closeSheet;
  $("#forgotBtn").onclick=()=>openForgot($("#l_email").value.trim());
  $("#loginForm").onsubmit=async e=>{e.preventDefault();
    const email=$("#l_email").value.trim(),pw=$("#l_pw").value;
    if(!email||!pw){$("#loginErr").textContent="Bitte E-Mail und Passwort eingeben.";return;}
    $("#doLogin").disabled=true;$("#loginErr").textContent="";
    const {error}=await sb.auth.signInWithPassword({email,password:pw});
    if(error){$("#doLogin").disabled=false;$("#loginErr").textContent=fehlertext(error);return;}
    closeSheet();toast("Angemeldet");
  };
  setTimeout(()=>$(prefill?"#l_pw":"#l_email")?.focus(),50);
}
function openForgot(prefill){
  sheet("Passwort vergessen",`<form id="forgotForm" class="stack" novalidate>
      <p class="hint">Wir schicken dir einen Link per E-Mail. Damit meldest du dich an und legst ein neues Passwort fest.</p>
      <label class="f" for="fg_email">E-Mail<input id="fg_email" type="email" autocomplete="username" required value="${esc(prefill||"")}"></label>
      <span class="err" id="forgotErr"></span><span class="ok" id="forgotOk"></span>
    </form>`,
    `<button class="btn ghost" id="backLogin">Zurück</button><span class="spacer"></span><button class="btn primary" id="doForgot" form="forgotForm" type="submit">Link schicken</button>`);
  $("#backLogin").onclick=()=>openLogin($("#fg_email").value.trim());
  $("#forgotForm").onsubmit=async e=>{e.preventDefault();
    const email=$("#fg_email").value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$("#forgotErr").textContent="Bitte eine gültige E-Mail-Adresse eingeben.";return;}
    $("#doForgot").disabled=true;$("#forgotErr").textContent="";
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:siteUrl()});
    if(error&&/rate limit|too many/i.test(error.message||"")){$("#doForgot").disabled=false;$("#forgotErr").textContent=fehlertext(error);return;}
    // Aus Sicherheitsgründen nicht verraten, ob es die Adresse gibt
    $("#forgotOk").textContent="Wenn es zu dieser Adresse ein Konto gibt, ist der Link unterwegs. Schau auch im Spam-Ordner nach.";
  };
}
function openSetPassword(kind){
  const invite=kind==="invite";
  sheet(invite?"Willkommen im Braubuch":"Neues Passwort festlegen",`<form id="pwForm" class="stack" novalidate>
      <p class="hint">${invite?"Du wurdest als Braumeister eingeladen. Leg jetzt dein Passwort fest – damit meldest du dich künftig an.":"Du bist über den Link aus der E-Mail angemeldet. Leg jetzt ein neues Passwort fest."}</p>
      ${invite?`<label class="f" for="pw_name">Dein Name<input id="pw_name" autocomplete="name" value="${esc(state.profile?.name||"")}"></label>`:""}
      <label class="f" for="pw_1">Neues Passwort (mindestens 8 Zeichen)<input id="pw_1" type="password" autocomplete="new-password" minlength="8" required></label>
      <label class="f" for="pw_2">Passwort wiederholen<input id="pw_2" type="password" autocomplete="new-password" minlength="8" required></label>
      <span class="err" id="pwErr"></span>
    </form>`,
    `<span class="spacer"></span><button class="btn primary" id="doPw" form="pwForm" type="submit">Passwort speichern</button>`);
  $("#pwForm").onsubmit=async e=>{e.preventDefault();
    const a=$("#pw_1").value,b=$("#pw_2").value;
    if(a.length<8){$("#pwErr").textContent="Bitte mindestens 8 Zeichen.";return;}
    if(a!==b){$("#pwErr").textContent="Die beiden Passwörter stimmen nicht überein.";return;}
    $("#doPw").disabled=true;$("#pwErr").textContent="";
    const {error}=await sb.auth.updateUser({password:a});
    if(error){$("#doPw").disabled=false;$("#pwErr").textContent=fehlertext(error);return;}
    if(invite){const n=$("#pw_name").value.trim();if(n&&state.profile&&n!==state.profile.name){await sb.from("profile").update({name:n}).eq("id",state.profile.id);state.profile.name=n;renderChrome();}}
    closeSheet();toast("Passwort gespeichert");
  };
  setTimeout(()=>$(invite?"#pw_name":"#pw_1")?.focus(),50);
}

/* --- Mein Konto --- */
function openAccount(){
  const p=state.profile||{};
  sheet("Mein Konto",`<form id="accForm" class="stack" novalidate>
      <label class="f" for="acc_name">Name<input id="acc_name" autocomplete="name" value="${esc(p.name||"")}"></label>
      <p class="hint">Angemeldet als ${esc(state.session?.user?.email||p.email||"")}${p.rolle?` · ${esc(ROLLEN[p.rolle])}`:""}</p>
      <label class="f" for="acc_pw">Neues Passwort (leer lassen, um es zu behalten)<input id="acc_pw" type="password" autocomplete="new-password" minlength="8"></label>
      <span class="err" id="accErr"></span>
    </form>`,
    `<button class="btn ghost" id="logoutBtn">Abmelden</button><span class="spacer"></span><button class="btn" id="cancelAcc">Abbrechen</button><button class="btn primary" id="doAcc" form="accForm" type="submit">Speichern</button>`);
  $("#cancelAcc").onclick=closeSheet;
  $("#logoutBtn").onclick=async()=>{$("#logoutBtn").disabled=true;await sb.auth.signOut();closeSheet();toast("Abgemeldet");};
  $("#accForm").onsubmit=async e=>{e.preventDefault();
    const n=$("#acc_name").value.trim(),pw=$("#acc_pw").value;
    if(!n){$("#accErr").textContent="Bitte einen Namen eintragen.";return;}
    if(pw&&pw.length<8){$("#accErr").textContent="Das Passwort braucht mindestens 8 Zeichen.";return;}
    $("#doAcc").disabled=true;$("#accErr").textContent="";
    if(n!==p.name){const {error}=await sb.from("profile").update({name:n}).eq("id",p.id);if(error){$("#doAcc").disabled=false;$("#accErr").textContent=fehlertext(error);return;}state.profile.name=n;}
    if(pw){const {error}=await sb.auth.updateUser({password:pw});if(error){$("#doAcc").disabled=false;$("#accErr").textContent=fehlertext(error);return;}}
    renderChrome();closeSheet();toast("Gespeichert");
  };
}

/* --- Verwaltung (nur Admin) --- */
async function openAdmin(){
  if(!isAdmin())return;
  await loadPeople();
  const me=state.profile.id;
  const opts=r=>`<option value="admin"${r==="admin"?" selected":""}>Admin</option><option value="braumeister"${r==="braumeister"?" selected":""}>Braumeister</option><option value=""${!r?" selected":""}>Kein Zugriff</option>`;
  const people=state.people.slice().sort((a,b)=>(a.name||"").localeCompare(b.name||"","de")).map(p=>`<div class="person">
      <div class="pn"><b>${esc(p.name||"–")}${p.id===me?" (du)":""}</b><span>${esc(p.email||"")}</span></div>
      <select data-id="${esc(p.id)}" aria-label="Rolle von ${esc(p.name||p.email||"")}"${p.id===me?" disabled title=\"Deine eigene Rolle kannst du nicht ändern\"":""}>${opts(p.rolle)}</select>
    </div>`).join("");
  sheet("Verwaltung",`
    <section class="sec"><h3>Braumeister einladen</h3>
      <form id="invForm" class="stack" novalidate>
        <label class="f" for="inv_name">Name<input id="inv_name" autocomplete="off"></label>
        <label class="f" for="inv_email">E-Mail<input id="inv_email" type="email" autocomplete="off"></label>
        <p class="hint">Die Person bekommt eine E-Mail mit einem Link, legt ihr Passwort fest und ist dann Braumeister.</p>
        <span class="err" id="invErr"></span><span class="ok" id="invOk"></span>
        <button class="btn primary" id="doInv" type="submit" style="align-self:flex-start">Einladung schicken</button>
      </form>
    </section>
    <section class="sec"><h3>Zugänge und Rollen</h3><div class="people" id="people">${people}</div>
      <p class="hint" style="margin-top:10px">„Kein Zugriff“ sperrt einen Zugang, ohne ihn zu löschen. Löschen von Einträgen kann nur der Admin.</p>
    </section>`,
    `<span class="spacer"></span><button class="btn" id="closeAdmin">Schließen</button>`);
  $("#closeAdmin").onclick=closeSheet;
  $("#people").querySelectorAll("select[data-id]").forEach(sel=>sel.onchange=async()=>{
    const id=sel.dataset.id,rolle=sel.value||null;sel.disabled=true;
    const {error}=await sb.from("profile").update({rolle}).eq("id",id);
    sel.disabled=false;
    if(error){toast(fehlertext(error));await loadPeople();openAdmin();return;}
    const p=state.people.find(x=>x.id===id);if(p)p.rolle=rolle;toast("Rolle gespeichert");
  });
  $("#invForm").onsubmit=async e=>{e.preventDefault();
    const name=$("#inv_name").value.trim(),email=$("#inv_email").value.trim();
    $("#invErr").textContent="";$("#invOk").textContent="";
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$("#invErr").textContent="Bitte eine gültige E-Mail-Adresse eingeben.";return;}
    $("#doInv").disabled=true;
    const {data,error}=await sb.functions.invoke("einladen",{body:{email,name,redirectTo:siteUrl()}});
    $("#doInv").disabled=false;
    if(error){let msg="Die Einladung hat nicht geklappt.";try{const j=await error.context.json();if(j&&j.fehler)msg=j.fehler;}catch(_){}$("#invErr").textContent=msg;return;}
    if(data&&data.ok){$("#invOk").textContent=`Einladung an ${email} ist unterwegs.`;$("#inv_name").value="";$("#inv_email").value="";await loadPeople();}
  };
}

/* --- Daten laden --- */
async function loadProfile(){
  state.profile=null;
  if(!state.session)return;
  const {data}=await sb.from("profile").select("id,name,email,rolle").eq("id",state.session.user.id).maybeSingle();
  state.profile=data||{id:state.session.user.id,name:"",email:state.session.user.email,rolle:null};
}
async function loadPeople(){
  state.people=[];
  if(!isBM())return;
  const {data}=await sb.from("profile").select("id,name,email,rolle");
  state.people=data||[];
}
let refreshing=null;
async function refresh(){
  if(refreshing)return refreshing;
  refreshing=(async()=>{
    notice("");
    await loadProfile();
    await loadPeople();
    renderChrome();
    if(KB.seite&&KB.seite.laden)await KB.seite.laden();
  })();
  try{await refreshing;}finally{refreshing=null;}
}

/* --- Start --- */
async function boot(){
  markMenu();
  if(!window.supabase||!window.supabase.createClient){notice("Die Seite konnte nicht geladen werden. Bitte neu laden.");return;}
  sb=window.supabase.createClient(CONFIG.url,CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"implicit"}});
  KB.sb=sb;
  $("#closeBtn").onclick=closeSheet;$("#scrim").onclick=closeSheet;
  $("#themeBtn").onclick=themeUmschalten; themeKnopfZeichnen();
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#sheet").hidden)closeSheet();});
  $("#loginBtn").onclick=()=>openLogin();
  $("#accountBtn").onclick=openAccount;
  $("#adminBtn").onclick=openAdmin;
  if(KB.seite&&KB.seite.start)KB.seite.start();

  const {data:{session}}=await sb.auth.getSession();
  state.session=session;
  await refresh();
  if(linkInfo.error){
    history.replaceState(null,"",location.pathname+location.search);
    notice("Der Link aus der E-Mail ist abgelaufen oder wurde schon benutzt. Fordere über „Anmelden → Passwort vergessen?“ einen neuen an.");
  }
  if(session&&(linkInfo.type==="invite"||linkInfo.type==="recovery")){
    history.replaceState(null,"",location.pathname+location.search);
    openSetPassword(linkInfo.type);
  }

  sb.auth.onAuthStateChange((event,s)=>{
    // Keine Supabase-Aufrufe direkt im Callback (sonst Blockade) – kurz entkoppeln
    setTimeout(async()=>{
      if(event==="PASSWORD_RECOVERY"){state.session=s;await refresh();openSetPassword("recovery");return;}
      if(event==="SIGNED_IN"||event==="SIGNED_OUT"||event==="USER_UPDATED"){
        const changed=(state.session?.user?.id||null)!==(s?.user?.id||null);
        state.session=s;
        if(changed||event==="SIGNED_OUT"){closeSheet();await refresh();}
      }
      if(event==="TOKEN_REFRESHED")state.session=s;
    },0);
  });
}

const KB = window.KB = {
  CONFIG, ROLLEN, $, esc, state, isBM, isAdmin, siteUrl, sb: null, seite: null,
  fmtDate, fmtDateLong, fmtDateTime, fmtZahl, personName, todayIso, toast, notice, lsGet, lsSet,
  sheet, openSheet, closeSheet, kv, sec, fehlertext, refresh, renderChrome, loadPeople,
};
document.addEventListener("DOMContentLoaded", boot);
})();
