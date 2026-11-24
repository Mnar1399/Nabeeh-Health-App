const API_BASE = "";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let allArticles = [];
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
  if (translations[lang][headingKey]) $("#page-heading").textContent = translations[lang][headingKey];
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
const guides = {
  home:{icon:"⌂",title:"الرئيسية",text:"ابدأ من هنا للتعرف على نبيه، ثم انتقل مباشرة إلى التحقق من أي معلومة صحية."},
  trends:{icon:"↗",title:"ترندات الصحة",text:"تصفح الموضوعات والشائعات المتداولة. لن نعرض حكمًا على أي موضوع قبل التحقق من مصادره."},
  verify:{icon:"⌕",title:"مساعد التحقق",text:"اكتب الادعاء الصحي بوضوح. لا تشارك اسمك أو بياناتك الطبية الخاصة في المحادثة."},
  history:{icon:"◷",title:"سجل التحققات",text:"ستجد هنا الأسئلة ونتائج التحقق السابقة المرتبطة بحسابك بعد تفعيل تسجيل الدخول."},
  plans:{icon:"♧",title:"الاشتراكات",text:"قارن بين العضويات وحدود الاستخدام. الأسعار النهائية ستعلن بعد اعتماد الباقات."},
  saved:{icon:"♡",title:"المحفوظات",text:"احتفظ بالمقالات التي تهمك للعودة إليها لاحقًا. ستصبح مرتبطة بحسابك عند تفعيل الحسابات."},
  profile:{icon:"◎",title:"ملفك الصحي",text:"يمكنك إضافة العمر والوزن والطول والاهتمامات اختياريًا. لا تضف معلومات طبية حساسة."}
};
function showGuide(page) {
  const guide = guides[page];
  if (!guide || sessionStorage.getItem("nabeeh_guide_" + page)) return;
  $("#guide-icon").textContent = guide.icon;
  $("#guide-title").textContent = guide.title;
  $("#guide-text").textContent = guide.text;
  $("#guide-progress").style.setProperty("--progress","100%");
  $("#page-guide").classList.add("open");
  $("#page-guide").setAttribute("aria-hidden","false");
  sessionStorage.setItem("nabeeh_guide_" + page,"1");
}
function closeGuide() {
  $("#page-guide").classList.remove("open");
  $("#page-guide").setAttribute("aria-hidden","true");
}
$("#guide-next").addEventListener("click",closeGuide);
$("#guide-skip").addEventListener("click",closeGuide);

function goToPage(page, withGuide=true) {
  if (!$("#page-" + page)) return;
  currentPage = page;
  $$(".page").forEach(el => el.classList.toggle("active",el.id === "page-" + page));
  $$(".nav-link").forEach(el => el.classList.toggle("active",el.dataset.page === page));
  const key = pageHeadings[page];
  $("#page-heading").textContent = key ? translations[currentLanguage][key] : "Nabeeh";
  window.scrollTo({top:0,behavior:"smooth"});
  if (page === "saved") renderSaved();
  if (page === "trends") loadHealthTrends();
  if (page === "history") renderHistory();
  if (withGuide) showGuide(page);
}
$$("[data-page]").forEach(button => button.addEventListener("click",() => goToPage(button.dataset.page)));

function escapeHTML(value="") {
  return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
}
function renderArticleCard(article) {
  const saved=savedIds.includes(Number(article.id));
  return `<article class="article-card"><div class="article-top"><span class="article-tag">${escapeHTML(article.category||"معلومة صحية")}</span><button class="save-btn ${saved?"saved":""}" data-save="${article.id}" aria-label="حفظ المقال">${saved?"♥":"♡"}</button></div><h3>${escapeHTML(article.title||"مادة صحية")}</h3><p class="article-excerpt">${escapeHTML(String(article.content||"").slice(0,145))}…</p><div class="article-bottom"><span class="article-source">مصدر صحي</span><button class="read-link" data-open="${article.id}">اقرأ المزيد ←</button></div></article>`;
}
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

$$("[data-trend-filter]").forEach(button=>button.addEventListener("click",()=>{
  $$("[data-trend-filter]").forEach(b=>b.classList.toggle("active",b===button));
  const filter=button.dataset.trendFilter;
  $$(".trend-card").forEach((card,index)=>{
    const category=["nutrition","nutrition","fitness"][index]||"rumors";
    card.style.display=filter==="all"||filter===category?"flex":"none";
  });
}));

// Account form is a UI prototype only; never store passwords or Nafath credentials in the browser.
$("#open-login").addEventListener("click",()=>{
  $("#login-modal").classList.add("open");
  $("#login-modal").setAttribute("aria-hidden","false");
});
function closeLogin(){ $("#login-modal").classList.remove("open");$("#login-modal").setAttribute("aria-hidden","true"); }
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
