/* Koldingbräu – Test-Attrappe für supabase-js: Daten liegen im Speicher, nichts geht ins Netz.
   Rolle über localStorage "test_rolle": anon | bm | admin. Wird von tests/run_tests.py statt vendor/supabase.js ausgeliefert. */
// Test-Attrappe für supabase-js: Daten im Speicher, Rolle über localStorage "test_rolle" (anon|bm|admin)
(function(){
const rolle = localStorage.getItem("test_rolle") || "anon";
const uid = "u1";
const log = window.__calls = [];
const stile=[{id:1,name:"Pils",reihenfolge:10},{id:2,name:"Helles",reihenfolge:20},{id:15,name:"IPA",reihenfolge:150}];
const biere=[{id:"b1",name:"Kolding Kölsch",brauerei:"Koldingbräu",eigen:true,alkohol:4.9,stil_id:1,sud_id:null,notiz:null,bild_kronkorken:"biere/b1/kronkorken-a.jpg",bild_flasche:null},{id:"b2",name:"Augustiner Hell",brauerei:"Augustiner",eigen:false,alkohol:5.2,stil_id:2,sud_id:null,notiz:null},{id:"b3",name:"Hazy Hops",brauerei:"Kehrwieder",eigen:false,alkohol:6.5,stil_id:15}];
const db={
 profile:[{id:uid,name:"Niels",email:"n@x.de",rolle:rolle==="admin"?"admin":"braumeister"}],
 sude:[{id:"s1",status:"dokumentiert",nr:1,datum:"2024-03-01",stil:"Kölsch",ausschlag:20,stammwuerze:11.5,malz:[{sorte:"Pils",gramm:4000}],hopfen:[],maischplan:[],oeffentlich:true,bewertung:8.6},{id:"s2",status:"dokumentiert",nr:2,datum:"2025-05-01",stil:"IPA",malz:[],hopfen:[],maischplan:[],oeffentlich:false,bewertung:9.4}],
 bierstile:stile,
 verkostungen:[{id:"v1",titel:"Herbstrunde",datum:"2026-10-17",ort:"Hamburg",blind:false,status:"laeuft",code:"abc234defg",proben:[{count:3}],teilnehmer:[{count:2}]}],
 proben:[{id:"p1",verkostung_id:"v1",bier_id:"b1",nummer:1},{id:"p2",verkostung_id:"v1",bier_id:"b2",nummer:2},{id:"p3",verkostung_id:"v1",bier_id:"b3",nummer:3}],
 teilnehmer:[{id:"t1",verkostung_id:"v1",name:"Anna"},{id:"t2",verkostung_id:"v1",name:"Ben"}],
 bewertungen:[{id:"w1",probe_id:"p1",teilnehmer_id:"t1",note:8,merkmale:{bitter:4,koerper:6},geruch:["malzig"],fehler:[],nochmal:true,kommentar:"Schön rund",ausgeblendet:false},
              {id:"w2",probe_id:"p1",teilnehmer_id:"t2",note:7,merkmale:{bitter:6},geruch:["malzig","Zitrus"],fehler:[],nochmal:false,kommentar:null,ausgeblendet:false},
              {id:"w3",probe_id:"p2",teilnehmer_id:"t1",note:9,merkmale:{},geruch:[],fehler:["Butter"],nochmal:true,kommentar:"Top",ausgeblendet:false}],
 verkostung_bilder:[{id:"g1",verkostung_id:"v1",pfad:"verkostungen/v1/galerie/a.jpg",teilnehmer_id:"t1",angelegt:"2026"}],
 sud_bilder:[{id:"sb1",sud_id:"s1",pfad:"sude/s1/galerie/foto-a.jpg",bildunterschrift:"Einmaischen",angelegt:"2026-03-01T07:00:00Z"}],
 vorschlaege:[{id:"x1",verkostung_id:"v1",teilnehmer_id:"t2",name:"Mitbringsel",brauerei:"Br",stil:"IPA",status:"offen",angelegt:"2026"}],
 biere,
 anlagen:[{id:1,name:"Koldingbräu",sudhausausbeute:65,verdampfung:3,standard_menge:20,notiz:null}],
 rezepte:[{id:"r1",name:"Kolding Kölsch",stil:"Kölsch",autor:"Koldingbräu",quelle:"eigenes Rezept",ausschlag:20,sudhausausbeute:65,stammwuerze:11.5,bittere:24,farbe:8,alkohol:4.8,
   malze:[{name:"Pilsner",gramm:3500,ebc:3.5},{name:"Weizenmalz",gramm:400,ebc:4}],rasten:[{temperatur:63,zeit:40},{temperatur:72,zeit:20}],einmaischtemperatur:57,abmaischtemperatur:78,
   hauptguss:14,nachguss:13,kochzeit:70,hopfen:[{sorte:"Magnum",gramm:10,alpha:14,zeit:70,typ:"Kochen"},{sorte:"Tettnanger",gramm:20,alpha:4,zeit:10,typ:"Kochen"}],weitere:[],
   hefe:"K-97",gaertemperatur:"16",endvergaerungsgrad:80,karbonisierung:5,oeffentlich:true,eltern_id:null,aus_sud_id:null},
  {id:"r2",name:"Geheimes Rezept",stil:"IPA",ausschlag:20,malze:[],hopfen:[],rasten:[],weitere:[],oeffentlich:false,eltern_id:null}],
};
// Zustand über Seitenwechsel hinweg (Import → Rezeptseite → Sud) im sessionStorage halten
try{const g=JSON.parse(sessionStorage.getItem("fake_db")||"null");if(g)Object.keys(g).forEach(k=>db[k]=g[k]);}catch(_){}
const merken=()=>{try{sessionStorage.setItem("fake_db",JSON.stringify(db));}catch(_){}};
const embed=(t,r)=>{
 if(t==="proben"){const b=biere.find(x=>x.id===r.bier_id);return {...r,biere:{...b,bierstile:stile.find(s=>s.id===b.stil_id)}};}
 if(t==="biere")return {...r,bierstile:stile.find(s=>s.id===r.stil_id),proben:[{count:db.proben.filter(p=>p.bier_id===r.id).length}]};
 return r;
};
function q(t){
 let rows=null, op="select", filters=[], single=false, maybe=false, payload=null;
 const api={
  select(){return api;}, order(){return api;},
  eq(k,v){filters.push(r=>r[k]===v);return api;}, not(k,o,v){filters.push(r=>r[k]!=null);return api;}, limit(){return api;}, neq(k,v){filters.push(r=>r[k]!==v);return api;}, in(k,v){filters.push(r=>v.includes(r[k]));return api;}, or(expr){const teile=expr.split(/,(?=\w+\.eq\.)/).map(x=>{const m=x.match(/^(\w+)\.eq\.(.*)$/);let v=m[2];if(/^".*"$/.test(v))v=JSON.parse(v);return [m[1],v];});filters.push(r=>teile.some(([k,v])=>String(r[k])===v));return api;},
  insert(p){op="insert";payload=p;return api;}, update(p){op="update";payload=p;return api;}, delete(){op="delete";return api;}, upsert(p){op="upsert";payload=p;return api;},
  single(){single=true;return api;}, maybeSingle(){maybe=true;return api;},
  then(res,rej){
   log.push([t,op,payload]);
   let tab=db[t]||(db[t]=[]);
   if(rolle==="anon"&&t==="rezepte"&&op==="select"){tab=tab.filter(r=>r.oeffentlich);}
   else if(rolle==="anon"&&t!=="sude"&&t!=="bierstile"&&t!=="profile")return Promise.resolve({data:null,error:{message:"permission denied",code:"42501"}}).then(res,rej);
   let out;
   if(op==="select"){out=tab.filter(r=>filters.every(f=>f(r))).map(r=>embed(t,r));}
   else if(op==="insert"){const arr=(Array.isArray(payload)?payload:[payload]).map(p=>({id:t[0]+Math.random().toString(36).slice(2,7),code:"neucode234",status:"vorbereitung",...p}));tab.push(...arr);out=arr;}
   else if(op==="update"){out=tab.filter(r=>filters.every(f=>f(r)));out.forEach(r=>Object.assign(r,payload));}
   else if(op==="delete"){out=tab.filter(r=>filters.every(f=>f(r)));db[t]=tab.filter(r=>!out.includes(r));}
   else if(op==="upsert"){out=payload.map(p=>{const r=tab.find(x=>x.id===p.id);Object.assign(r,p);return r;});}
   if(op!=="select")merken();
   const data=single||maybe?(out[0]||null):out;
   return Promise.resolve({data,error:null}).then(res,rej);
  }};
 return api;
}
const gaeste={};
function vkLaden({p_code,p_token}){
 const v=db.verkostungen.find(x=>x.code===p_code); if(!v)return {error:{code:"P0002",message:"Diese Verkostung gibt es nicht (mehr)."}};
 const t=db.teilnehmer.find(x=>x.token===p_token);
 const offen=!v.blind||v.status==="abgeschlossen";
 const proben=db.proben.filter(p=>p.verkostung_id===v.id).sort((a,b)=>a.nummer-b.nummer).map(p=>{const b=biere.find(x=>x.id===p.bier_id);const w=db.bewertungen.filter(x=>x.probe_id===p.id&&!x.ausgeblendet);
   return {id:p.id,nummer:p.nummer,bier:offen?{name:b.name,brauerei:b.brauerei,eigen:b.eigen,stil:stile.find(s=>s.id===b.stil_id)?.name,alkohol:b.alkohol,bild_kronkorken:b.bild_kronkorken||null,bild_flasche:b.bild_flasche||null}:null,schnitt:w.length?w.reduce((a,x)=>a+x.note,0)/w.length:null,anzahl:w.length,nochmal:w.filter(x=>x.nochmal).length};});
 const gal=(db.verkostung_bilder||[]).filter(g=>g.verkostung_id===v.id);
 return {data:{verkostung:{titel:v.titel,datum:v.datum,ort:v.ort,blind:v.blind,status:v.status,bild_titel:v.bild_titel||null},teilnehmer:db.teilnehmer.length,proben,galerie:gal.map(g=>({pfad:g.pfad,mein:!!t&&g.teilnehmer_id===t.id})),
   ich:t?{name:t.name,bewertungen:db.bewertungen.filter(x=>x.teilnehmer_id===t.id),vorschlaege:[],bilder:gal.filter(g=>g.teilnehmer_id===t.id).length}:null},error:null};
}
const rpcs={
 vk_laden:vkLaden,
 vk_beitreten({p_code,p_name}){const t={id:"t"+Math.random(),verkostung_id:"v1",name:p_name,token:"tok"+Math.random()};db.teilnehmer.push(t);return {data:{id:t.id,token:t.token,name:t.name},error:null};},
 vk_bewerten(a){const t=db.teilnehmer.find(x=>x.token===a.p_token);let w=db.bewertungen.find(x=>x.probe_id===a.p_probe&&x.teilnehmer_id===t.id);if(!w){w={id:"w"+Math.random(),probe_id:a.p_probe,teilnehmer_id:t.id,ausgeblendet:false};db.bewertungen.push(w);}Object.assign(w,{note:a.p_note,merkmale:a.p_merkmale,geruch:a.p_geruch,fehler:a.p_fehler,nochmal:a.p_nochmal,kommentar:a.p_kommentar});window.__letzte=a;return {data:{ok:true},error:null};},
 rezept_sude(a){return {data:db.sude.filter(s=>s.rezept_id===a.p_rezept).map(s=>({id:s.id,nr:s.nr,datum:s.datum,oeffentlich:s.oeffentlich})),error:null};},
 vk_admin_bewerten(a){window.__admin=a;let w=db.bewertungen.find(x=>x.probe_id===a.p_probe&&x.teilnehmer_id===a.p_teilnehmer);if(!w){w={id:"w"+Math.random(),probe_id:a.p_probe,teilnehmer_id:a.p_teilnehmer,ausgeblendet:false,nachgetragen:true};db.bewertungen.push(w);}else{w.original_note=w.original_note??w.note;}Object.assign(w,{note:a.p_note,kommentar:a.p_kommentar,admin_geaendert:"2026-10-18T11:00:00Z"});return {data:{ok:true},error:null};},
 vk_admin_teilnehmer(a){const t={id:"tx"+Math.random(),verkostung_id:a.p_verkostung,name:a.p_name};db.teilnehmer.push(t);return {data:t.id,error:null};},
 vk_vorschlagen(){return {data:{ok:true},error:null};},
 vk_angekuendigt(){return {data:[],error:null};},
 vk_archiv(){return {data:[{id:"v0",titel:"Frühjahrsrunde",bild_titel:"verkostungen/v0/titel-a.jpg",datum:"2026-04-01",ort:"Hamburg",teilnehmer:7,namen:["Niels","Carsten","Jan"],proben:[{nummer:2,name:"Augustiner Hell",brauerei:"Augustiner",stil:"Helles",alkohol:5.2,schnitt:8.14,anzahl:7,nochmal:6},{nummer:1,name:"Kolding Kölsch",brauerei:"Koldingbräu",stil:"Pils",schnitt:7.5,anzahl:6,nochmal:3}]},{id:"v9",titel:"Pils & Lager",datum:"2026-10-18",ort:null,teilnehmer:3,namen:["Niels","Carsten","Jan"],proben:[{nummer:2,name:"Einbecker",schnitt:9,anzahl:3,nochmal:3}]}],error:null};},
 vk_ergebnis(){const P=(nr,n,s,no,nm,ext)=>Object.assign({nummer:nr,bier_id:"b"+nr,name:n,brauerei:n.split(" ")[0],eigen:false,stil:s,alkohol:null,schnitt:no,anzahl:3,nochmal:nm,noten:[no,no,no],merkmale:{},geruch:{},fehler:{},kommentare:[]},ext||{});
   return {data:{verkostung:{id:"v9",titel:"Pils & Lager",datum:"2026-10-18",ort:"Röntbarg",blind:false,bild_titel:"verkostungen/v9/titel-a.jpg"},galerie:["verkostungen/v9/galerie/a.jpg","verkostungen/v9/galerie/b.jpg"],teilnehmer:["Niels","Carsten","Jan"],proben:[
    P(1,"Tyskie","Lager",6,3,{merkmale:{suesse:{wert:3,n:1},koerper:{wert:3,n:1}},kommentare:["Wenig Charakter."]}),
    P(2,"Einbecker","Pils",9,3,{noten:[10,9,8],merkmale:{bitter:{wert:7,n:1},kohlensaeure:{wert:7,n:1}},geruch:{blumig:1},kommentare:["Geheimtipp! Prickelbitterness.","Geheimtipp – der Hopfen ist gut da."]}),
    P(3,"Störtebeker","Pils",4,0),P(4,"Budweiser","Lager",5,0,{fehler:{Butter:2}}),P(5,"Flensburger","Pils",2,0),
    P(6,"Pilsner Urquell","Pils",8,3,{geruch:{brotig:1,"röstig":1}}),P(7,"Staropramen","Lager",7,3)]},error:null};},
 liga_daten(){const r=[];const add=(id,n,br,e,s,d,sum,an,no)=>r.push({bier_id:id,name:n,brauerei:br,eigen:e,stil:s,verkostung_id:"v"+d,titel:"Runde "+d,datum:d,summe:sum,anzahl:an,nochmal:no});
   add("00000000-0000-0000-0000-0000000000b1","Kolding Kölsch","Koldingbräu",true,"Kölsch","2026-04-01",45,6,4);add("00000000-0000-0000-0000-0000000000b1","Kolding Kölsch","Koldingbräu",true,"Kölsch","2025-10-01",30,4,2);
   add("b2","Augustiner Hell","Augustiner",false,"Helles","2026-04-01",57,7,6);add("00000000-0000-0000-0000-0000000000b3","Hazy Hops","Kehrwieder",false,"IPA","2026-04-01",20,3,1);return {data:r,error:null};},
 bier_detail(a){
   const biereMap={
    "00000000-0000-0000-0000-0000000000b1":{id:a.p_id,name:"Kolding Kölsch",brauerei:"Koldingbräu",eigen:true,stil:"Kölsch",alkohol:4.9,bild_kronkorken:"biere/b1/kronkorken-a.jpg",bild_flasche:null},
    "b2":{id:a.p_id,name:"Augustiner Hell",brauerei:"Augustiner",eigen:false,stil:"Helles",alkohol:5.2,bild_kronkorken:null,bild_flasche:null},
    "00000000-0000-0000-0000-0000000000b3":{id:a.p_id,name:"Hazy Hops",brauerei:"Kehrwieder",eigen:false,stil:"IPA",alkohol:6.5,bild_kronkorken:null,bild_flasche:null},
   };
   const b=biereMap[a.p_id];
   if(!b) return {data:null,error:{message:"Dieses Bier gibt es nicht."}};
   if(a.p_id==="00000000-0000-0000-0000-0000000000b3")
     return {data:{bier:b,schnitt:6.67,anzahl:3,nochmal:1,noten:[8,7,5],merkmale:{bitter:{wert:7,n:3},intensitaet:{wert:6,n:3}},geruch:{tropisch:2,harzig:1},fehler:{},kommentare:["Schön harzig-herb.","Trinkt sich leicht."],verkostungen:[{id:"v2026-04-01",titel:"Runde 2026-04-01",datum:"2026-04-01",schnitt:6.67,anzahl:3,nochmal:1}]},error:null};
   return {data:{bier:b,schnitt:null,anzahl:0,nochmal:0,noten:[],merkmale:{},geruch:{},fehler:{},kommentare:[],verkostungen:[]},error:null};
 },
};
window.supabase={createClient(){return {
 from:q,
 rpc(n,a){log.push(["rpc",n,a]);return Promise.resolve(rpcs[n](a||{}));},
 auth:{getSession:()=>Promise.resolve({data:{session:rolle==="anon"?null:{user:{id:uid,email:"n@x.de"}}}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},signInWithPassword:()=>Promise.resolve({error:null}),signOut:()=>Promise.resolve({})},
 functions:{invoke(n,o){log.push(["fn",n]);window.__invoke=n;if(n==="galerie-hochladen"){const tok=o.body.get("token");const t=db.teilnehmer.find(x=>x.token===tok);db.verkostung_bilder.push({id:"g"+Math.random(),verkostung_id:"v1",pfad:"verkostungen/v1/galerie/neu.jpg",teilnehmer_id:t&&t.id});merken();}return Promise.resolve({data:{ok:true},error:null});}},
 storage:{from(b){return {upload(pfad,blob){(window.__uploads=window.__uploads||[]).push(pfad);return Promise.resolve({data:{path:pfad},error:null});},remove(ps){(window.__removed=window.__removed||[]).push(...ps);return Promise.resolve({data:ps,error:null});},createSignedUrls(ps){return Promise.resolve({data:ps.map(p=>({path:p,signedUrl:"https://fake.supabase.co/storage/v1/object/public/"+b+"/"+p+"?token=t"})),error:null});}};}},
};}};
})();
