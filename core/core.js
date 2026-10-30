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

/* --- Seitenblatt (weiterhin genutzt von Rezepten, Verkostungen, Liga, Verwaltung, Neuer Sud) --- */
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

/* --- Konto-Menü: ein einziger Container oben rechts statt eigenem Seitenblatt für Anmeldung/Konto --- */
let panelCloseFn=null;
function accInitials(p){
  const name=((p&&p.name)||"").trim();
  if(name){
    const parts=name.split(/\s+/).filter(Boolean);
    if(parts.length>=2)return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
    return parts[0].slice(0,2).toUpperCase();
  }
  const email=(p&&p.email)||"";
  return email?email[0].toUpperCase():"?";
}
function openPanel(){$("#accountPanel").hidden=false;$("#accountToggle").setAttribute("aria-expanded","true");}
function closePanel(){
  const panel=$("#accountPanel");if(!panel||panel.hidden)return;
  panel.hidden=true;
  $("#accountToggle").setAttribute("aria-expanded","false");
  const extra=$("#accPanelExtra");if(extra){extra.hidden=true;extra.innerHTML="";}
  if(state.session){const li=$("#loggedInView");if(li)li.hidden=false;const lo=$("#loggedOutView");if(lo)lo.hidden=true;}
  const f=panelCloseFn;panelCloseFn=null;if(f)f();
}
function showExtra(html,opts){
  const lo=$("#loggedOutView"),li=$("#loggedInView"),extra=$("#accPanelExtra");
  if(lo)lo.hidden=true;if(li)li.hidden=true;
  extra.hidden=false;extra.innerHTML=html;
  panelCloseFn=(opts&&opts.onClose)||null;
  openPanel();
}
function backToMain(){
  const extra=$("#accPanelExtra");if(extra){extra.hidden=true;extra.innerHTML="";}
  if(state.session){$("#loggedInView").hidden=false;}else{$("#loggedOutView").hidden=false;}
}

/* --- Kopfzeile je nach Rolle --- */
function renderChrome(){
  const inn=!!state.session, bm=isBM(), adm=isAdmin();
  $("#adminBtn").hidden=!adm;
  const label=$("#accToggleLabel"),av=$("#accToggleAvatar"),toggle=$("#accountToggle");
  if(inn&&state.profile){
    const initials=accInitials(state.profile);
    if(label)label.hidden=true;
    if(av){av.hidden=false;av.textContent=initials;}
    if(toggle)toggle.classList.add("is-avatar");
    const big=$("#accAvatarBig");if(big)big.textContent=initials;
    const nm=$("#accNameTxt");if(nm)nm.textContent=state.profile.name||state.profile.email||"Mein Konto";
    const role=$("#accRoleTxt");
    if(role){
      if(state.profile.rolle){role.hidden=false;role.textContent=ROLLEN[state.profile.rolle];role.className="role "+state.profile.rolle;}
      else role.hidden=true;
    }
  }else{
    if(label){label.hidden=false;label.textContent="Login";}
    if(av)av.hidden=true;
    if(toggle)toggle.classList.remove("is-avatar");
  }
  // Solange das Konto-Menü offen ist (und kein Unterformular wie "Passwort vergessen" zeigt), passend umschalten
  const panel=$("#accountPanel"),extra=$("#accPanelExtra");
  if(panel&&!panel.hidden&&extra&&extra.hidden){
    $("#loggedOutView").hidden=inn;
    $("#loggedInView").hidden=!inn;
  }
  if(inn&&state.profile&&!bm)notice("Dein Konto hat noch keine Freigabe als Braumeister. Bitte wende dich an den Admin.");
  if(KB.seite&&KB.seite.chrome)KB.seite.chrome();
}
function markMenu(){
  const s=document.body.dataset.seite;
  document.querySelectorAll(".menu a[data-seite]").forEach(a=>{if(a.dataset.seite===s)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
}
function wireMenu(){
  const btn=$("#menuToggle");
  if(!btn)return;
  const header=btn.closest(".site-header");
  btn.onclick=()=>{
    const open=header.classList.toggle("open");
    btn.setAttribute("aria-expanded",open?"true":"false");
    btn.setAttribute("aria-label",open?"Menü schließen":"Menü öffnen");
    if(!open)closePanel();
  };
  document.querySelectorAll(".menu a[data-seite]").forEach(a=>{
    a.addEventListener("click",()=>{
      header.classList.remove("open");
      btn.setAttribute("aria-expanded","false");
      btn.setAttribute("aria-label","Menü öffnen");
    });
  });
}
function wireAccountPanel(){
  const toggle=$("#accountToggle"),panel=$("#accountPanel"),wrap=$("#accountWrap");
  if(!toggle||!panel||!wrap)return;
  toggle.onclick=()=>{
    if(panel.hidden){
      const extra=$("#accPanelExtra");if(extra){extra.hidden=true;extra.innerHTML="";}
      $("#loggedOutView").hidden=!!state.session;
      $("#loggedInView").hidden=!state.session;
      openPanel();
      setTimeout(()=>{if(!state.session)$("#l_email")?.focus();},50);
    }else{
      closePanel();
    }
  };
  document.addEventListener("click",e=>{if(!panel.hidden&&!wrap.contains(e.target))closePanel();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!panel.hidden)closePanel();});
  // Login-Formular ist im Markup fest verdrahtet (kein eigenes Seitenblatt mehr)
  $("#loginForm").onsubmit=async e=>{e.preventDefault();
    const email=$("#l_email").value.trim(),pw=$("#l_pw").value;
    if(!email||!pw){$("#loginErr").textContent="Bitte E-Mail und Passwort eingeben.";return;}
    $("#doLogin").disabled=true;$("#loginErr").textContent="";
    const {error}=await sb.auth.signInWithPassword({email,password:pw});
    if(error){$("#doLogin").disabled=false;$("#loginErr").textContent=fehlertext(error);return;}
    $("#doLogin").disabled=false;$("#l_pw").value="";$("#loginErr").textContent="";
    closePanel();toast("Angemeldet");
  };
  $("#forgotBtn").onclick=()=>openForgot($("#l_email").value.trim());
  $("#accountBtn").onclick=openAccount;
  $("#adminBtn").onclick=()=>{closePanel();openAdmin();};
  $("#logoutQuickBtn").onclick=async()=>{$("#logoutQuickBtn").disabled=true;await sb.auth.signOut();$("#logoutQuickBtn").disabled=false;closePanel();toast("Abgemeldet");};
  // Aktionsknöpfe, die ihr eigenes Seitenblatt öffnen (Neuer Sud, Als CSV sichern), schließen danach das Konto-Menü
  $("#loggedInView").addEventListener("click",e=>{
    if(e.target.closest("#accountBtn")||e.target.closest("#logoutQuickBtn"))return;
    if(e.target.closest(".btn"))closePanel();
  });
}

/* --- Hell/Dunkel --- */
const ICON_MOND=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></svg>`;
const ICON_SONNE=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>`;
function aktuellesTheme(){
  const t=lsGet("kb_theme");
  if(t==="light"||t==="dark")return t;
  return window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
}
function themeAnwenden(t){document.documentElement.setAttribute("data-theme",t);}
function themeKnopfZeichnen(){
  const btn=$("#themeBtn");if(!btn)return;
  const t=aktuellesTheme();
  btn.innerHTML=t==="dark"?ICON_SONNE:ICON_MOND;
  btn.setAttribute("aria-label",t==="dark"?"Hellmodus aktivieren":"Dunkelmodus aktivieren");
}
function themeUmschalten(){
  const neu=aktuellesTheme()==="dark"?"light":"dark";
  lsSet("kb_theme",neu);
  themeAnwenden(neu);
  themeKnopfZeichnen();
}

/* --- Passwort vergessen, Passwort festlegen: als Unteransicht im Konto-Menü --- */
function openForgot(prefill){
  showExtra(`<p class="acc-extra-title">Passwort vergessen</p>
    <form id="forgotForm" class="stack" novalidate>
      <p class="hint">Wir schicken dir einen Link per E-Mail. Damit meldest du dich an und legst ein neues Passwort fest.</p>
      <label class="f" for="fg_email">E-Mail<input id="fg_email" type="email" autocomplete="username" required value="${esc(prefill||"")}"></label>
      <span class="err" id="forgotErr"></span><span class="ok" id="forgotOk"></span>
      <div class="acc-row"><button type="button" class="btn ghost" id="backLogin">Zurück</button><button class="btn primary" id="doForgot" type="submit">Link schicken</button></div>
    </form>`);
  $("#backLogin").onclick=()=>{$("#l_email").value=$("#fg_email").value.trim();backToMain();};
  $("#forgotForm").onsubmit=async e=>{e.preventDefault();
    const email=$("#fg_email").value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$("#forgotErr").textContent="Bitte eine gültige E-Mail-Adresse eingeben.";return;}
    $("#doForgot").disabled=true;$("#forgotErr").textContent="";
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:siteUrl()});
    if(error&&/rate limit|too many/i.test(error.message||"")){$("#doForgot").disabled=false;$("#forgotErr").textContent=fehlertext(error);return;}
    // Aus Sicherheitsgründen nicht verraten, ob es die Adresse gibt
    $("#forgotOk").textContent="Wenn es zu dieser Adresse ein Konto gibt, ist der Link unterwegs. Schau auch im Spam-Ordner nach.";
  };
  setTimeout(()=>$("#fg_email")?.focus(),50);
}
function openSetPassword(kind){
  const invite=kind==="invite";
  showExtra(`<p class="acc-extra-title">${invite?"Willkommen im Braubuch":"Neues Passwort festlegen"}</p>
    <form id="pwForm" class="stack" novalidate>
      <p class="hint">${invite?"Du wurdest als Braumeister eingeladen. Leg jetzt dein Passwort fest – damit meldest du dich künftig an.":"Du bist über den Link aus der E-Mail angemeldet. Leg jetzt ein neues Passwort fest."}</p>
      ${invite?`<label class="f" for="pw_name">Dein Name<input id="pw_name" autocomplete="name" value="${esc(state.profile?.name||"")}"></label>`:""}
      <label class="f" for="pw_1">Neues Passwort (mindestens 8 Zeichen)<input id="pw_1" type="password" autocomplete="new-password" minlength="8" required></label>
      <label class="f" for="pw_2">Passwort wiederholen<input id="pw_2" type="password" autocomplete="new-password" minlength="8" required></label>
      <span class="err" id="pwErr"></span>
      <button class="btn primary" id="doPw" type="submit">Passwort speichern</button>
    </form>`);
  $("#pwForm").onsubmit=async e=>{e.preventDefault();
    const a=$("#pw_1").value,b=$("#pw_2").value;
    if(a.length<8){$("#pwErr").textContent="Bitte mindestens 8 Zeichen.";return;}
    if(a!==b){$("#pwErr").textContent="Die beiden Passwörter stimmen nicht überein.";return;}
    $("#doPw").disabled=true;$("#pwErr").textContent="";
    const {error}=await sb.auth.updateUser({password:a});
    if(error){$("#doPw").disabled=false;$("#pwErr").textContent=fehlertext(error);return;}
    if(invite){const n=$("#pw_name").value.trim();if(n&&state.profile&&n!==state.profile.name){await sb.from("profile").update({name:n}).eq("id",state.profile.id);state.profile.name=n;renderChrome();}}
    closePanel();toast("Passwort gespeichert");
  };
  setTimeout(()=>$(invite?"#pw_name":"#pw_1")?.focus(),50);
}

/* --- Mein Konto: ebenfalls Unteransicht im Konto-Menü --- */
function openAccount(){
  const p=state.profile||{};
  showExtra(`<p class="acc-extra-title">Mein Konto</p>
    <form id="accForm" class="stack" novalidate>
      <label class="f" for="acc_name">Name<input id="acc_name" autocomplete="name" value="${esc(p.name||"")}"></label>
      <p class="hint">Angemeldet als ${esc(state.session?.user?.email||p.email||"")}${p.rolle?` · ${esc(ROLLEN[p.rolle])}`:""}</p>
      <label class="f" for="acc_pw">Neues Passwort (leer lassen, um es zu behalten)<input id="acc_pw" type="password" autocomplete="new-password" minlength="8"></label>
      <span class="err" id="accErr"></span>
      <div class="acc-row"><button type="button" class="btn ghost" id="backAcc">Zurück</button><button class="btn primary" id="doAcc" type="submit">Speichern</button></div>
    </form>`);
  $("#backAcc").onclick=backToMain;
  $("#accForm").onsubmit=async e=>{e.preventDefault();
    const n=$("#acc_name").value.trim(),pw=$("#acc_pw").value;
    if(!n){$("#accErr").textContent="Bitte einen Namen eintragen.";return;}
    if(pw&&pw.length<8){$("#accErr").textContent="Das Passwort braucht mindestens 8 Zeichen.";return;}
    $("#doAcc").disabled=true;$("#accErr").textContent="";
    if(n!==p.name){const {error}=await sb.from("profile").update({name:n}).eq("id",p.id);if(error){$("#doAcc").disabled=false;$("#accErr").textContent=fehlertext(error);return;}state.profile.name=n;}
    if(pw){const {error}=await sb.auth.updateUser({password:pw});if(error){$("#doAcc").disabled=false;$("#accErr").textContent=fehlertext(error);return;}}
    renderChrome();closePanel();toast("Gespeichert");
  };
}

/* --- Verwaltung (nur Admin) – bleibt ein eigenes, größeres Seitenblatt --- */
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
  wireMenu();
  wireAccountPanel();
  themeAnwenden(aktuellesTheme());
  themeKnopfZeichnen();
  const themeBtn=$("#themeBtn");if(themeBtn)themeBtn.onclick=themeUmschalten;
  if(!window.supabase||!window.supabase.createClient){notice("Die Seite konnte nicht geladen werden. Bitte neu laden.");return;}
  sb=window.supabase.createClient(CONFIG.url,CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"implicit"}});
  KB.sb=sb;
  $("#closeBtn").onclick=closeSheet;$("#scrim").onclick=closeSheet;
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#sheet").hidden)closeSheet();});
  if(KB.seite&&KB.seite.start)KB.seite.start();

  const {data:{session}}=await sb.auth.getSession();
  state.session=session;
  await refresh();
  if(linkInfo.error){
    history.replaceState(null,"",location.pathname+location.search);
    notice("Der Link aus der E-Mail ist abgelaufen oder wurde schon benutzt. Fordere über „Login → Passwort vergessen?“ einen neuen an.");
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
        if(changed||event==="SIGNED_OUT"){closeSheet();closePanel();await refresh();}
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

// Logo-Animation: einmal beim Laden der Seite abspielen, danach erneut bei jedem
// Hover mit der Maus (nicht bei Touch, da es dort kein echtes Hover gibt).
function kbPlayLogoAnim(){
  const teile = document.querySelectorAll(".kb-bottle, .kb-cap");
  if(!teile.length) return;
  teile.forEach(el=>el.classList.remove("kb-run"));
  void document.body.offsetWidth; // Reflow erzwingen, damit die Animation neu startet
  teile.forEach(el=>el.classList.add("kb-run"));
}
document.addEventListener("DOMContentLoaded", ()=>{
  setTimeout(kbPlayLogoAnim, 150);
  document.querySelectorAll(".brand-mini").forEach(el=>{
    el.addEventListener("pointerenter", e=>{
      if(e.pointerType==="mouse") kbPlayLogoAnim();
    });
  });
});
})();
