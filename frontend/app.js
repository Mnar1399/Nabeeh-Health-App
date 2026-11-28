const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];let items=[],me=null,mode="login";
function go(id){$$(".page").forEach(p=>p.classList.toggle("active",p.id===id));$$("nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===id));if(id==="saved")loadSaved();if(id==="account")loadProfile();}
$$("[data-page]").forEach(b=>b.onclick=()=>go(b.dataset.page));
async function init(){
if(!sessionStorage.getItem("nabeeh_tab_session")){
await fetch("/api/logout",{method:"POST"});
sessionStorage.setItem("nabeeh_tab_session","1");
}
me=(await(await fetch("/api/me")).json()).user;
$("#authopen").classList.toggle("hide",!!me);
$("#useremail").classList.toggle("hide",!me);
$("#headerlogout").classList.add("hide");
$("#useremail").textContent=me?.email||"";
$("#useremail").setAttribute("aria-expanded","false");
$("#emailshow").textContent=me?.email||"سجّل الدخول لعرض بريدك.";
$("#logout").classList.toggle("hide",!me);
items=await(await fetch("/api/articles")).json();render();
}
function card(a){return `<article class="card"><div class="cover ${a.category}">${a.icon}<small>✓ تم التحقق منه</small></div><div class="cardbody"><span class="tag">${a.label}</span><button class="save" data-save="${a.id}">♡</button><h3>${a.title}</h3><p>${a.claim}</p><div class="cardfoot"><small>${a.date}</small><button class="textbtn" data-open="${a.id}">اقرأ التفاصيل ←</button></div></div></article>`;}
function render(){let f=$(".filters .on")?.dataset.filter||"all";$("#news").innerHTML=items.filter(a=>f==="all"||a.category===f).map(card).join("");bind();}
function bind(){$$("[data-open]").forEach(b=>b.onclick=()=>detail(b.dataset.open));$$("[data-save]").forEach(b=>b.onclick=()=>save(b.dataset.save));}
$$("[data-filter]").forEach(b=>b.onclick=()=>{$$(".filters button").forEach(x=>x.classList.toggle("on",x===b));render();});
function detail(id){let a=items.find(x=>x.id===id);$("#detailbox").innerHTML=`<article class="detail"><div class="detailcover">${a.icon}</div><div class="detailbody"><span class="verified">✓ تم التحقق منه</span><h1>${a.title}</h1><h3>الادعاء</h3><p>${a.claim}</p><h3>الحقيقة</h3><p>${a.truth}</p><h3>كيف تحققنا؟</h3><p>${a.method}</p><div class="detailactions"><button class="secondary" id="dsave">♡ حفظ</button><button class="secondary" id="share">↗ مشاركة</button></div><small>محتوى تجريبي للعرض فقط، وليس تحققًا طبيًا حقيقيًا.</small></div></article>`;go("detail");$("#dsave").onclick=()=>save(id);$("#share").onclick=()=>{navigator.clipboard?.writeText(location.origin+"/#"+id);alert("تم نسخ الرابط");};}
async function save(id){if(!me){$("#modal").classList.remove("hide");return;}let r=await fetch("/api/saved/"+id,{method:"POST"});if(r.ok)alert("تم الحفظ");}
async function loadSaved(){if(!me){$("#savedgrid").innerHTML="سجّل الدخول لعرض محفوظاتك.";return;}let a=await(await fetch("/api/saved")).json();$("#savedgrid").innerHTML=a.map(card).join("");bind();}
$("#authopen").onclick=()=>$("#modal").classList.remove("hide");$("#close").onclick=()=>$("#modal").classList.add("hide");$$("[data-mode]").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;$$("[data-mode]").forEach(x=>x.classList.toggle("selected",x===b));$("#authtitle").textContent=mode==="login"?"تسجيل الدخول":"إنشاء حساب";$("#authsubmit").textContent=$("#authtitle").textContent;});
$("#auth").onsubmit=async e=>{e.preventDefault();let f=new FormData(e.target),r=await fetch("/api/"+(mode==="login"?"login":"register"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:f.get("email"),password:f.get("password")})}),d=await r.json();if(!r.ok){$("#authstatus").textContent=d.detail;return;}$("#modal").classList.add("hide");init();};
async function signOut(){
await fetch("/api/logout",{method:"POST"});
me=null;
$("#headerlogout").classList.add("hide");
$("#useremail").classList.add("hide");
$("#useremail").setAttribute("aria-expanded","false");
$("#authopen").classList.remove("hide");
$("#emailshow").textContent="سجّل الدخول لعرض بريدك.";
$("#logout").classList.add("hide");
$("#health").reset();
}
$("#logout").onclick=signOut;
$("#useremail").onclick=(e)=>{
e.stopPropagation();
const menu=$("#headerlogout");
const willOpen=menu.classList.contains("hide");
menu.classList.toggle("hide",!willOpen);
$("#useremail").setAttribute("aria-expanded",String(willOpen));
};
$("#headerlogout").onclick=signOut;
document.addEventListener("click",e=>{
if(!e.target.closest(".actions")){
$("#headerlogout").classList.add("hide");
$("#useremail").setAttribute("aria-expanded","false");
}
});
$("#report").onsubmit=async e=>{e.preventDefault();let r=await fetch("/api/submissions",{method:"POST",body:new FormData(e.target)}),d=await r.json();$("#reportstatus").textContent=r.ok?"تم استلام الادعاء.":(d.detail||"تعذر إرسال الادعاء.");if(r.ok)e.target.reset();};
function displayChatAnswer(node, raw){
  const text=String(raw||"").replace(/\\n/g,"\n").replace(/\r\n/g,"\n").replace(/\[(https?:\/\/[^\]]+)\]\((https?:\/\/[^)]+)\)/g,"$1");
  node.replaceChildren();
  const urlPattern=/https?:\/\/[^\s<>"')\]]+/g;
  let last=0,match;
  while((match=urlPattern.exec(text))!==null){
    node.append(document.createTextNode(text.slice(last,match.index)));
    const link=document.createElement("a");
    link.href=match[0];
    link.textContent=match[0];
    link.target="_blank";
    link.rel="noopener noreferrer";
    node.append(link);
    last=urlPattern.lastIndex;
  }
  node.append(document.createTextNode(text.slice(last)));
}
$("#chatform").onsubmit=async e=>{e.preventDefault();let m=$("#chattext").value.trim();if(!m)return;let p=document.createElement("p");p.className="you";p.textContent=m;$("#messages").append(p);$("#chattext").value="";let q=document.createElement("p");q.className="bot";q.textContent="نبيه يراجع المعلومات...";$("#messages").append(q);let r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:m})}),d=await r.json();displayChatAnswer(q,d.answer||d.detail);};
async function loadProfile(){if(!me)return;let d=await(await fetch("/api/profile")).json();for(let [k,v] of Object.entries(d.health||{}))if($("#health").elements[k])$("#health").elements[k].value=v??"";}
$("#health").onsubmit=async e=>{e.preventDefault();let f=new FormData(e.target),q=new URLSearchParams(f);let r=await fetch("/api/profile?"+q,{method:"PUT"});$("#healthstatus").textContent=r.ok?"تم الحفظ":"سجّل الدخول أولًا";};
$("#lang").onclick=()=>{document.documentElement.lang=document.documentElement.lang==="ar"?"en":"ar";document.documentElement.dir=document.documentElement.lang==="ar"?"rtl":"ltr";$("#lang").textContent=document.documentElement.lang==="ar"?"EN":"عربي";};
init();