const API_BASE = "";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let allArticles = [];
let activeNewsFilter = "all";
let savedIds = JSON.parse(localStorage.getItem("nabeeh_saved") || "[]");
let currentPage = "home";
let authMode = "login";
let authMethod = "email";
let currentLanguage = "ar";
let healthProfileDraft = {};
let historyDraft = [];

const translations = {
  en: {
    login:"Sign in", tagline:"Your health starts with knowledge", home:"Home", trends:"Health trends", verify:"Check a claim", history:"Check history", plans:"Memberships", saved:"Saved", profile:"Health profile",
    heroKicker:"Health information fact-checking platform", heroTitle:"Don't believe everything you hear about your health.", heroText:"Before following advice or sharing a health claim, let Nabeeh help you review it against reliable sources.", heroButton:"Check a health claim now", visualTitle:"Health awareness starts here", visualText:"Check · Understand · Share responsibly",
    trendsEyebrow:"What's circulating in health", trendsTitle:"Health trends and rumors", trendsText:"Explore popular health topics and understand what reliable sources say.",
    chatTitle:"Ask Nabeeh about a health claim", chatText:"Write a claim or question. The conversation and verification result will appear here.",
    historyTitle:"Your verification history", historyText:"Claims you have checked before.", plansTitle:"Choose your membership", profileTitle:"Your health profile",
    homeHeading:"Welcome to Nabeeh", trendsHeading:"Health trends", verifyHeading:"Check a health claim", historyHeading:"Verification history", plansHeading:"Memberships", savedHeading:"Saved items", profileHeading:"Your health profile",
    claimPlaceholder:"Write a health claim or rumor...", send:"Send", profileSave:"Save on this device", language:"عربي"
  },
  ar: {
    login:"تسجيل الدخول", tagline:"صحتك تبدأ من المعلومة", home:"الرئيسية", trends:"ترندات الصحة", verify:"تحقق من معلومة", history:"سجل التحققات", plans:"الاشتراكات", saved:"المحفوظات", profile:"ملفي الصحي",
    heroKicker:"منصة التحقق من المعلومات الصحية", heroTitle:"لا تصدّق كل ما يُقال عن صحتك.", heroText:"قبل ما تتبع نصيحة أو تشارك معلومة صحية، خلّ نبيه يساعدك تتحقق منها بالرجوع إلى مصادر موثوقة.", heroButton:"تحقق من المعلومة الآن", visualTitle:"وعي صحي يبدأ هنا", visualText:"تحقق · افهم · شارك بوعي",
    trendsEyebrow:"المتداول في عالم الصحة", trendsTitle:"ترندات الصحة والشائعات", trendsText:"تعرّف على المواضيع الصحية المنتشرة، وافهم ما تقوله المصادر عنها.",
    chatTitle:"اسأل نبيه عن معلومة صحية", chatText:"اكتب الادعاء أو السؤال، وستظهر المحادثة ونتيجة التحقق هنا.",
    historyTitle:"سجل التحققات", historyText:"الأسئلة والادعاءات التي تحققت منها سابقًا.", plansTitle:"اختر العضوية المناسبة لك", profileTitle:"معلوماتك الصحية",
    homeHeading:"مرحبًا بك في نبيه", trendsHeading:"ترندات الصحة", verifyHeading:"التحقق من المعلومة", historyHeading:"سجل التحققات", plansHeading:"الاشتراكات", savedHeading:"المحفوظات", profileHeading:"ملفي الصحي",
    claimPlaceholder:"اكتب المعلومة أو الشائعة الصحية هنا...", send:"إرسال", profileSave:"حفظ المعلومات على هذا الجهاز", language:"EN"
  }
};

function setLanguage(lang) {
  currentLanguage = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.body.classList.toggle("english-ui", lang === "en");
  $$("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (translations[lang][key]) el.textContent = translations[lang][key];
  });
  $("#language-toggle b").textContent = translations[lang].language;
  $("#language-toggle").setAttribute("aria-label", lang === "ar" ? "Switch to English" : "التبديل إلى العربية");
  const headingKey = currentPage + "Heading";
  if (translations[lang][headingKey] && $("#page-heading")) $("#page-heading").textContent = translations[lang][headingKey];
  $("#claim-input").placeholder = translations[lang].claimPlaceholder;
}
$("#language-toggle").addEventListener("click", () => setLanguage(currentLanguage === "ar" ? "en" : "ar"));

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}
const pageHeadings = {home:"homeHeading",trends:"trendsHeading",verify:"verifyHeading",history:"historyHeading",plans:"plansHeading",saved:"savedHeading",profile:"profileHeading"};
const guideTours = {
 home:[{target:".home-hero-copy",title:"مرحبًا بك في نبيه",text:"هذه الصفحة الرئيسية؛ من هنا تبدأ رحلتك للتحقق من المعلومات الصحية."},{target:".hero-button",title:"ابدأ التحقق",text:"اضغط هنا للانتقال إلى المحادثة وكتابة الادعاء الصحي."}],
 trends:[{target:"[data-guide='trends-intro']",title:"ترندات الصحة",text:"هنا نعرض المواضيع الصحية المنتشرة التي نجمعها من موجز وزارة الصحة."},{target:"[data-guide='trends-filters']",title:"تصفّح المواضيع",text:"استخدم التصنيفات للوصول إلى مواضيع التغذية واللياقة والشائعات."},{target:"#trends-grid",title:"المعلومة والمصدر",text:"اقرأ ملخص المادة وافتح رابط وزارة الصحة الأصلي. ظهورها هنا لا يعني أنها خضعت للتحقق."}],
 verify:[{target:".page-intro",title:"تحقق من معلومة",text:"اكتب الادعاء الصحي الذي وصل إليك وتريد التحقق منه."},{target:"[data-guide='verify-chat']",title:"محادثة نبيه",text:"ستظهر هنا نتيجة التحقق والتفسير والمصادر بعد ربط محرك الذكاء الاصطناعي."}],
 history:[{target:".page-intro",title:"سجل التحققات",text:"ستجد هنا أسئلتك السابقة ونتائجها بعد تفعيل الحسابات والحفظ."}],
 plans:[{target:".plans-grid",title:"الاشتراكات",text:"تعرف على العضويات وحدود الاستخدام. الدفع غير مفعّل حاليًا."}],
 saved:[{target:".page-intro",title:"المحفوظات",text:"هنا تجد المواد الصحية التي تحفظها للعودة إليها."}],
 profile:[{target:".page-intro",title:"ملفك الصحي",text:"يمكنك إضافة معلومات اختيارية لتخصيص المحتوى الذي يظهر لك."},{target:"[data-guide='profile-fields']",title:"بياناتك الصحية",text:"أدخل العمر والوزن والطول واهتماماتك. كل الحقول اختيارية."}]
};
let activeTour=[],activeTourIndex=0,activeTourPage="";
function showGuide(page){
 const tour=guideTours[page];
 if(!tour||sessionStorage.getItem("nabeeh_guide_"+page))return;
 activeTour=tour;activeTourIndex=0;activeTourPage=page;renderGuideStep();
}
function renderGuideStep(){
 const step=activeTour[activeTourIndex],tip=$("#guide-tip");
 if(!step||!tip)return closeGuide();
 const target=document.querySelector(step.target);
 if(!target)return closeGuide();
 $$(".guide-highlight").forEach(el=>el.classList.remove("guide-highlight"));
 target.classList.add("guide-highlight");
 $("#guide-title").textContent=step.title;
 $("#guide-text").textContent=step.text;
 $("#guide-step").textContent=(activeTourIndex+1)+" / "+activeTour.length;
 $("#guide-next").textContent=activeTourIndex===activeTour.length-1?"إنهاء":"التالي";
 tip.classList.add("visible");tip.setAttribute("aria-hidden","false");
 target.scrollIntoView({behavior:"smooth",block:"center"});
 requestAnimationFrame(()=>{
  const r=target.getBoundingClientRect(),b=tip.getBoundingClientRect();
  let top=r.bottom+12;
  if(top+b.height>innerHeight-12)top=r.top-b.height-12;
  top=Math.max(12,Math.min(top,innerHeight-b.height-12));
  const left=Math.max(12,Math.min(r.left+(r.width-b.width)/2,innerWidth-b.width-12));
  tip.style.top=top+"px";tip.style.left=left+"px";
 });
}
function closeGuide(){
 const tip=$("#guide-tip");
 if(tip){tip.classList.remove("visible");tip.setAttribute("aria-hidden","true");}
 $$(".guide-highlight").forEach(el=>el.classList.remove("guide-highlight"));
 if(activeTourPage)sessionStorage.setItem("nabeeh_guide_"+activeTourPage,"1");
 activeTour=[];activeTourIndex=0;activeTourPage="";
}
$("#guide-next").addEventListener("click",()=>{if(activeTourIndex<activeTour.length-1){activeTourIndex++;renderGuideStep();}else closeGuide();});
$("#guide-skip").addEventListener("click",closeGuide);
window.addEventListener("resize",()=>{if(activeTour.length)renderGuideStep();});
function escapeHTML(value="") {
  return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
}
function articleCategory(article) {
  const text=(String(article.title||"")+" "+String(article.content||"")+" "+String(article.category||"")).toLowerCase();
  if(/دواء|أدوية|علاج|لقاح|مضاد حيوي|medicine|drug|medication|vaccine/.test(text)) return "medicines";
  if(/غذاء|تغذية|طعام|وجبة|سعرات|حمية|فيتامين|nutrition|food|diet/.test(text)) return "nutrition";
  if(/رياضة|مشي|تمارين|لياقة|نشاط بدني|fitness|exercise|walking/.test(text)) return "fitness";
  if(/خبر|بيان|إعلان|وزارة|الصحة العامة|public health/.test(text)) return "news";
  return "general";
}
function renderArticleCard(article) {
  const saved=savedIds.includes(Number(article.id));
  const category=articleCategory(article);
  const labels={medicines:"الأدوية",nutrition:"التغذية",fitness:"اللياقة",news:"الأخبار",general:"الصحة العامة"};
  const excerpt=String(article.content||"").replace(/\\s+/g," ").slice(0,175);
  return `<article class="news-card">
    <div class="news-card-visual ${category}"><span>${category==="medicines"?"✚":category==="nutrition"?"❋":category==="fitness"?"↗":"✦"}</span><small>نبيه · معلومة موثوقة</small></div>
    <div class="news-card-body"><div class="news-card-meta"><span class="news-category">${labels[category]}</span><button class="save-btn ${saved?"saved":""}" data-save="${article.id}" aria-label="حفظ المادة">${saved?"♥":"♡"}</button></div>
    <h3>${escapeHTML(article.title||"مادة صحية")}</h3><p class="news-card-excerpt">${escapeHTML(excerpt)}${excerpt.length>=175?"…":""}</p>
    <div class="news-card-footer"><span>${escapeHTML(article.source_name||"وزارة الصحة")}</span><button class="read-link" data-open="${article.id}">اقرأ التفاصيل ←</button></div></div></article>`;
}
function renderArticles() {
 const grid=$("#articles-grid");if(!grid)return;
 const filtered=allArticles.filter(a=>activeNewsFilter==="all"||articleCategory(a)===activeNewsFilter);
 $("#articles-count").textContent=filtered.length+" مادة";
 grid.innerHTML=filtered.length?filtered.slice(0,30).map(renderArticleCard).join(""):'<div class="loading-card">لا توجد مواد في هذا التصنيف حاليًا.</div>';
 bindArticleActions();
}
async function loadArticles() {
 try {
  const response=await fetch(API_BASE+"/articles");if(!response.ok)throw new Error("API unavailable");
  allArticles=await response.json();renderArticles();
 } catch(error){console.warn("Nabeeh articles:",error);$("#articles-grid").innerHTML='<div class="loading-card">تعذر تحميل المواد. تأكد من تشغيل الخادم وتحديث قاعدة البيانات.</div>';}
}
async function openArticle(id) {
 const article=allArticles.find(item=>Number(item.id)===id);if(!article)return;
 const modal=$("#article-detail-modal"),box=$("#article-detail-content");
 const category=articleCategory(article);
 const labels={medicines:"الأدوية",nutrition:"التغذية",fitness:"اللياقة",news:"الأخبار",general:"الصحة العامة"};
 box.innerHTML=`<div class="detail-hero ${category}"><span>✦</span><small>${labels[category]}</small></div>
 <div class="detail-body"><span class="eyebrow">من مصادر نبيه الصحية</span><h1>${escapeHTML(article.title||"مادة صحية")}</h1>
 <div class="detail-source-note">مادة من ${escapeHTML(article.source_name||"مصدر صحي")}. هذه مادة توعوية وليست نتيجة تحقق من ادعاء.</div>
 <h3>المحتوى</h3><p class="detail-content-text">${escapeHTML(article.content||"لم يتوفر نص مستخرج من الصفحة.")}</p>
 <h3>المصدر</h3><a class="detail-source-link" href="${escapeHTML(article.url)}" target="_blank" rel="noopener noreferrer">فتح المصدر الأصلي ↗</a>
 <div class="detail-actions"><button data-detail-save="${article.id}" class="detail-save">${savedIds.includes(id)?"♥ محفوظ":"♡ حفظ"}</button><button id="detail-close-bottom" class="detail-close-bottom">إغلاق</button></div></div>`;
 modal.classList.add("open");modal.setAttribute("aria-hidden","false");
 $("#close-article-detail").onclick=closeArticleDetail;
 $("#detail-close-bottom").onclick=closeArticleDetail;
 box.querySelector("[data-detail-save]").onclick=()=>{savedIds=savedIds.includes(id)?savedIds.filter(x=>x!==id):[...savedIds,id];localStorage.setItem("nabeeh_saved",JSON.stringify(savedIds));openArticle(id);renderArticles();};
}
function closeArticleDetail(){const modal=$("#article-detail-modal");modal.classList.remove("open");modal.setAttribute("aria-hidden","true");}
$("#article-detail-modal").addEventListener("click",e=>{if(e.target.id==="article-detail-modal")closeArticleDetail();});
function bindArticleActions() {
  $$("[data-save]").forEach(btn=>btn.addEventListener("click",()=>{
    const id=Number(btn.dataset.save);
    savedIds=savedIds.includes(id)?savedIds.filter(x=>x!==id):[...savedIds,id];
    localStorage.setItem("nabeeh_saved",JSON.stringify(savedIds));
    renderArticles();showToast(savedIds.includes(id)?"تم الحفظ":"تمت إزالة المادة من المحفوظات");
  }));
  $$("[data-open]").forEach(btn=>btn.addEventListener("click",()=>openArticle(Number(btn.dataset.open))));
}
function renderArticles() {
  $("#articles-count") && ($("#articles-count").textContent=allArticles.length);
  const grid=$("#articles-grid");
  if (!grid) return;
  grid.innerHTML=allArticles.length?allArticles.slice(0,6).map(renderArticleCard).join(""):'<div class="loading-card">لا توجد مواد صحية منشورة بعد.</div>';
  bindArticleActions();
}
async function loadArticles() {
  try {
    const response=await fetch(API_BASE+"/articles");
    if(!response.ok) throw new Error("API unavailable");
    allArticles=await response.json();
    renderArticles();
  } catch(error) { console.warn("Nabeeh articles:",error); }
}
async function openArticle(id) {
  const article=allArticles.find(item=>Number(item.id)===id);
  if(!article)return;
  showToast("تفاصيل المقال: "+article.title);
}
function renderSaved() {
  const saved=allArticles.filter(a=>savedIds.includes(Number(a.id)));
  $("#saved-grid").innerHTML=saved.map(renderArticleCard).join("");
  $("#saved-empty").style.display=saved.length?"none":"block";
  bindArticleActions();
}
async function loadHealthTrends() {
  const grid = $("#trends-grid");
  if (!grid) return;
  grid.innerHTML = '<div class="loading-card">جاري تحميل أحدث المعلومات الصحية من مصادر وزارة الصحة...</div>';
  try {
    const response = await fetch(API_BASE + "/trends");
    if (!response.ok) throw new Error("Trends API unavailable");
    const items = await response.json();
    if (!items.length) {
      grid.innerHTML = '<div class="loading-card">لا توجد مواد من موجز وزارة الصحة حاليًا. شغّلي جامع RSS لتحديث المحتوى.</div>';
      return;
    }
    grid.innerHTML = items.map(item => {
      const excerpt = String(item.content || "").replace(/\\s+/g," ").slice(0,190);
      return `<article class="trend-card">
        <div class="trend-icon">✚</div>
        <span class="trend-tag">محتوى من ${escapeHTML(item.source_name || "مصدر صحي")}</span>
        <h2>${escapeHTML(item.title)}</h2>
        <p>${escapeHTML(excerpt)}${excerpt.length>=190?"…":""}</p>
        <div class="trend-bottom">
          <span class="verdict pending">محتوى توعوي · ليس حكم تحقق</span>
          <a class="text-button trend-source-link" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">المصدر الأصلي ↗</a>
        </div>
      </article>`;
    }).join("");
  } catch (error) {
    console.error(error);
    grid.innerHTML = '<div class="loading-card">تعذر تحميل الترندات. تأكدي من تشغيل خادم نبيه.</div>';
  }
}
function renderHistory() {
  const box=$("#history-list");
  if(!historyDraft.length) return;
  box.innerHTML=historyDraft.map(item=>`<article class="history-item"><span class="history-date">هذه الجلسة</span><p>${escapeHTML(item)}</p><span class="verdict pending">بانتظار ربط خدمة التحقق</span></article>`).join("");
}
function addChatMessage(text,type) {
  const el=document.createElement("div");
  el.className=type==="user"?"user-message":"bot-message";
  el.textContent=text;
  $("#chat-messages").appendChild(el);
  $("#chat-messages").scrollTop=$("#chat-messages").scrollHeight;
}
$("#check-claim").addEventListener("click",()=>{
  const claim=$("#claim-input").value.trim();
  if(!claim){$("#claim-input").focus();return;}
  addChatMessage(claim,"user");
  historyDraft.unshift(claim);
  $("#claim-input").value="";
  addChatMessage("وصلني سؤالك. واجهة المحادثة جاهزة، لكن إصدار حكم صحي أو حفظ سجل دائم يتطلب ربط محرك التحقق ومصادقة المستخدم أولًا.","bot");
  showToast("تمت إضافة السؤال إلى سجل هذه الجلسة");
});
$("#claim-input").addEventListener("keydown",event=>{
  if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();$("#check-claim").click();}
});

$$("[data-news-filter]").forEach(button=>button.addEventListener("click",()=>{
 $$("[data-news-filter]").forEach(b=>b.classList.toggle("active",b===button));
 activeNewsFilter=button.dataset.newsFilter;renderArticles();
}));
// Account form is a UI prototype only; never store passwords or Nafath credentials in the browser.
$("#open-login").addEventListener("click",()=>{
  $("#login-modal").classList.add("open");
  $("#login-modal").style.display = "flex";
  $("#login-modal").setAttribute("aria-hidden","false");
});
function closeLogin(){ $("#login-modal").classList.remove("open");$("#login-modal").style.display = "";$("#login-modal").setAttribute("aria-hidden","true"); }
$("#close-login").addEventListener("click",closeLogin);
$("#login-modal").addEventListener("click",e=>{if(e.target.id==="login-modal")closeLogin();});
$$("[data-auth-tab]").forEach(tab=>tab.addEventListener("click",()=>{
  authMethod=tab.dataset.authTab;
  $$("[data-auth-tab]").forEach(t=>t.classList.toggle("active",t===tab));
  $("#login-form").classList.toggle("hidden-field",authMethod==="nafath");
  $("#nafath-auth-panel").classList.toggle("hidden-field",authMethod!=="nafath");
}));
$("#show-signup").addEventListener("click",()=>{
  authMode=authMode==="login"?"signup":"login";
  $("#login-title").textContent=authMode==="signup"?"إنشاء حساب جديد":"تسجيل الدخول";
  $("#auth-description").textContent=authMode==="signup"?"أدخل اسمك ورقم جوالك وبريدك الإلكتروني لإنشاء حساب.":"ادخل باستخدام بريدك الإلكتروني وكلمة المرور.";
  $("#auth-name-label").classList.toggle("hidden-field",authMode!=="signup");
  $("#auth-phone-label").classList.toggle("hidden-field",authMode!=="signup");
  $("#auth-name").required=authMode==="signup";
  $("#auth-phone").required=authMode==="signup";
  $("#auth-submit").textContent=authMode==="signup"?"إنشاء الحساب":"تسجيل الدخول";
  $("#show-signup").textContent=authMode==="signup"?"لديك حساب؟ تسجيل الدخول":"إنشاء حساب جديد";
});
$("#login-form").addEventListener("submit",e=>{
  e.preventDefault();
  $("#login-hint").textContent="هذه واجهة تجريبية فقط. لم يتم إنشاء حساب أو إرسال بيانات. سنربطها بخدمة مصادقة آمنة قبل حفظ أي معلومات.";
});
$("#submit-news-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const form=event.currentTarget;
 const claim=$("#submission-claim").value.trim();
 const platform=form.querySelector('input[name="platform"]:checked')?.value;
 const sourceUrl=$("#submission-url").value.trim();
 const file=$("#submission-image").files[0];
 const feedback=$("#submission-feedback");
 if(!claim||!platform){feedback.textContent="يرجى كتابة الادعاء واختيار مكان ظهوره.";return;}
 let imageData=null;
 if(file){
  if(file.size>2*1024*1024){feedback.textContent="حجم الصورة يجب ألا يتجاوز 2 ميجابايت.";return;}
  imageData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
 }
 const button=form.querySelector(".submit-news-button");
 button.disabled=true;button.textContent="جارٍ إرسال البلاغ...";
 try{
  const response=await fetch(API_BASE+"/submissions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({claim,platform,source_url:sourceUrl||null,image_data:imageData})});
  if(!response.ok)throw new Error("تعذر حفظ البلاغ");
  const result=await response.json();
  feedback.textContent="تم استلام بلاغك بنجاح. رقم البلاغ: "+result.id+" — الحالة: بانتظار المراجعة.";
  form.reset();showToast("تم إرسال البلاغ إلى نبيه");
 }catch(error){feedback.textContent="تعذر إرسال البلاغ. تأكد من تشغيل الخادم ثم حاول مرة أخرى.";}
 finally{button.disabled=false;button.textContent="إرسال الادعاء";}
});
$("#nafath-button").addEventListener("click",()=>showToast("تسجيل نفاذ يتطلب موافقة وتكاملًا رسميًا، ولم يتم تفعيله."));
$("#nafath-button") && $("#nafath-button").addEventListener("click",()=>{});
$("#health-profile-form").addEventListener("submit",e=>{
  e.preventDefault();
  healthProfileDraft=Object.fromEntries(new FormData(e.currentTarget).entries());
  showToast("تم الاحتفاظ بالمعلومات مؤقتًا في هذه الجلسة فقط.");
  // Do not persist sensitive health data in localStorage without explicit consent and secure account storage.
});
$$("[data-plan]").forEach(button=>button.addEventListener("click",()=>showToast("تفاصيل هذه العضوية قيد الاعتماد؛ لا توجد عملية دفع مفعّلة.")));

loadArticles();
loadHealthTrends();
setLanguage("ar");
goToPage("home",false);
showGuide("home");
