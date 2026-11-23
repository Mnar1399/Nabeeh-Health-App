const API_BASE = ""; // نفس عنوان FastAPI؛ لا نحتاج سيرفرًا منفصلًا للواجهة
let allArticles = [];
let activeCategory = "all";
let showAllArticles = false;
let savedIds = JSON.parse(localStorage.getItem("nabeeh_saved") || "[]");

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2500);
}
function goToPage(page) {
  $$(".page").forEach(el => el.classList.remove("active"));
  const target = $(`#page-${page}`);
  if (target) target.classList.add("active");
  $$(".nav-link").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  const headings = {home:"مرحبًا بك في نبيه", how:"كيف يعمل نبيه؟", verify:"التحقق من المعلومة", plans:"الاشتراكات والعضويات", article:"المحتوى الصحي", saved:"المحفوظات"};
  $("#page-heading").textContent = headings[page] || "نبيه";
  window.scrollTo({top:0, behavior:"smooth"});
  if (page === "saved") renderSaved();
}
$$("[data-page]").forEach(button => button.addEventListener("click", () => goToPage(button.dataset.page)));

function getExcerpt(content, max = 145) {
  const clean = String(content || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max).trim() + "…" : clean;
}
function renderArticleCard(article) {
  const saved = savedIds.includes(Number(article.id));
  const category = article.category || "معلومة صحية";
  return `<article class="article-card">
    <div class="article-top"><span class="article-tag">${escapeHTML(category)}</span>
      <button class="save-btn ${saved ? "saved" : ""}" data-save="${article.id}" aria-label="حفظ المقال">${saved ? "♥" : "♡"}</button>
    </div>
    <h3>${escapeHTML(article.title || "مادة صحية")}</h3>
    <p class="article-excerpt">${escapeHTML(getExcerpt(article.content || article.description || "اقرأ التفاصيل من المصدر الصحي الأصلي."))}</p>
    <div class="article-bottom"><span class="article-source">وزارة الصحة / مصدر صحي</span><button class="read-link" data-open="${article.id}">اقرأ المزيد ←</button></div>
  </article>`;
}
function renderArticles() {
  const filtered = activeCategory === "all" ? allArticles : allArticles.filter(a => (a.category || "معلومة صحية") === activeCategory);
  const visible = showAllArticles ? filtered : filtered.slice(0, 6);
  $("#articles-grid").innerHTML = visible.length ? visible.map(renderArticleCard).join("") : `<div class="loading-card">لا توجد مواد في هذا التصنيف حاليًا.</div>`;
  $("#articles-count").textContent = allArticles.length;
  $("#articles-message").textContent = allArticles.length ? "" : "لم نعثر على مواد جاهزة للعرض. تأكد من تشغيل الـBackend وإضافة محتوى إلى قاعدة البيانات.";
  bindCardActions();
}
function renderCategories() {
  const categories = [...new Set(allArticles.map(a => a.category).filter(Boolean))];
  $("#category-filters").innerHTML = `<button class="filter-chip ${activeCategory === "all" ? "active" : ""}" data-category="all">الكل</button>` +
    categories.map(cat => `<button class="filter-chip ${activeCategory === cat ? "active" : ""}" data-category="${escapeHTML(cat)}">${escapeHTML(cat)}</button>`).join("");
  $$("[data-category]").forEach(btn => btn.addEventListener("click", () => {
    activeCategory = btn.dataset.category;
    renderCategories(); renderArticles();
  }));
}
function bindCardActions() {
  $$("[data-save]").forEach(btn => btn.addEventListener("click", () => {
    const id = Number(btn.dataset.save);
    savedIds = savedIds.includes(id) ? savedIds.filter(x => x !== id) : [...savedIds, id];
    localStorage.setItem("nabeeh_saved", JSON.stringify(savedIds));
    renderArticles();
    showToast(savedIds.includes(id) ? "تمت إضافة المادة إلى المحفوظات" : "تمت إزالة المادة من المحفوظات");
  }));
  $$("[data-open]").forEach(btn => btn.addEventListener("click", () => openArticle(Number(btn.dataset.open))));
}
async function loadArticles() {
  try {
    const response = await fetch(`${API_BASE}/articles`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    allArticles = await response.json();
    renderCategories();
    renderArticles();
  } catch (error) {
    $("#articles-grid").innerHTML = `<div class="loading-card"><strong>تعذر الاتصال بالخادم</strong><p>شغّل الـBackend على 127.0.0.1:8000 وتأكد من إعداد CORS.</p></div>`;
    $("#articles-message").textContent = "إذا كان الخادم يعمل، راجع إعدادات CORS في backend/main.py.";
    console.error("Nabeeh API:", error);
  }
}
async function openArticle(id) {
  goToPage("article");
  const article = allArticles.find(a => Number(a.id) === id);
  if (!article) return;
  let full = article;
  try {
    const response = await fetch(`${API_BASE}/articles/${id}`);
    if (response.ok) full = await response.json();
  } catch (e) { console.warn(e); }
  $("#article-detail").innerHTML = `
    <span class="article-tag">${escapeHTML(full.category || "معلومة صحية")}</span>
    <h2>${escapeHTML(full.title || "مادة صحية")}</h2>
    <div class="detail-meta">محتوى صحي · ${escapeHTML(full.language || "ar")}</div>
    <div class="detail-content">${escapeHTML(full.content || "لا يتوفر نص للمادة.")}</div>
    <div class="detail-source"><strong>المصدر الأصلي:</strong><br><a href="${escapeHTML(full.url || "#")}" target="_blank" rel="noopener noreferrer">${escapeHTML(full.url || "غير متوفر")}</a></div>`;
}
function renderSaved() {
  const saved = allArticles.filter(a => savedIds.includes(Number(a.id)));
  $("#saved-grid").innerHTML = saved.map(renderArticleCard).join("");
  $("#saved-empty").style.display = saved.length ? "none" : "block";
  bindCardActions();
}
$("#show-all").addEventListener("click", () => {
  showAllArticles = !showAllArticles;
  $("#show-all").innerHTML = showAllArticles ? "عرض أقل <span>↑</span>" : "عرض الكل <span>←</span>";
  renderArticles();
});
$("#claim-input").addEventListener("input", (event) => {
  $("#char-count").textContent = `${event.target.value.length} / 1000`;
});
$("#check-claim").addEventListener("click", () => {
  const claim = $("#claim-input").value.trim();
  if (!claim) {
    $("#verify-feedback").textContent = "اكتب المعلومة الصحية أولًا حتى تتمكن من بدء التحقق.";
    $("#claim-input").focus();
    return;
  }
  $("#verify-feedback").textContent = "تم استلام المعلومة في الواجهة. لم يتم إصدار حكم صحي بعد؛ يلزم ربط خدمة التحقق بالذكاء الاصطناعي ومصادر موثوقة قبل عرض نتيجة.";
  showToast("الواجهة جاهزة، وخدمة التحقق ستُربط في المرحلة التالية");
});
$("#show-all").addEventListener("keydown", e => { if (e.key === "Enter") e.currentTarget.click(); });
loadArticles();


// Login modal: presentation only until a secure authentication backend is connected.
const loginModal = $("#login-modal");
function openLogin() {
  loginModal.classList.add("open");
  loginModal.setAttribute("aria-hidden", "false");
  $("#login-email").focus();
}
function closeLogin() {
  loginModal.classList.remove("open");
  loginModal.setAttribute("aria-hidden", "true");
}
$("#open-login").addEventListener("click", openLogin);
$("#close-login").addEventListener("click", closeLogin);
loginModal.addEventListener("click", event => {
  if (event.target === loginModal) closeLogin();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeLogin();
});
$("#login-form").addEventListener("submit", event => {
  event.preventDefault();
  $("#login-hint").textContent = "تم التحقق من تنسيق البريد وإدخال كلمة المرور في النموذج فقط. لم يتم تسجيل الدخول؛ نحتاج إلى إنشاء نظام حسابات آمن وربطه بالخادم.";
});
$$("[data-plan]").forEach(button => button.addEventListener("click", () => {
  const plan = button.dataset.plan;
  if (plan === "المجانية") {
    showToast("العضوية المجانية ستكون خيار البداية عند تفعيل الحسابات.");
  } else {
    showToast("هذه العضوية قيد التجهيز، ولا توجد عملية دفع حاليًا.");
  }
}));
