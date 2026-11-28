import os, sqlite3, hashlib, secrets, re, unicodedata
from pathlib import Path
from fastapi import FastAPI, Request, Response, HTTPException, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field
ROOT=Path(__file__).resolve().parent.parent
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")
DB=ROOT/"data"/"nabeeh_prototype.db"
app=FastAPI(title="Nabeeh Web Prototype")

def conn():
    DB.parent.mkdir(exist_ok=True)
    c=sqlite3.connect(DB); c.row_factory=sqlite3.Row
    c.executescript("""
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE,password_hash TEXT);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER);
    CREATE TABLE IF NOT EXISTS saved(user_id INTEGER,article_id TEXT,PRIMARY KEY(user_id,article_id));
    CREATE TABLE IF NOT EXISTS submissions(id INTEGER PRIMARY KEY,claim TEXT,platform TEXT,source_url TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS health(user_id INTEGER PRIMARY KEY,age INTEGER,weight REAL,height REAL);
    CREATE TABLE IF NOT EXISTS moh_articles(id INTEGER PRIMARY KEY,title TEXT,content TEXT,url TEXT);
    """)
    return c

def hashpw(p,s=None):
    s=s or secrets.token_bytes(16)
    return s.hex()+"$"+hashlib.pbkdf2_hmac("sha256",p.encode(),s,260000).hex()
def validpw(p,h):
    try:
        s,v=h.split("$");return secrets.compare_digest(hashpw(p,bytes.fromhex(s)).split("$")[1],v)
    except:return False
def who(req):
    t=req.cookies.get("nabeeh_session")
    if not t:return None
    c=conn();r=c.execute("SELECT users.id,users.email FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token=?",(t,)).fetchone();c.close()
    return dict(r) if r else None
def login_cookie(uid,res):
    t=secrets.token_urlsafe(32);c=conn();c.execute("INSERT INTO sessions VALUES(?,?)",(t,uid));c.commit();c.close()
    res.set_cookie("nabeeh_session",t,httponly=True,samesite="lax")

@app.get("/")
def home(): return FileResponse(ROOT/"frontend"/"index.html")
app.mount("/static",StaticFiles(directory=ROOT/"frontend"),name="static")

class Auth(BaseModel):
    email:EmailStr
    password:str=Field(min_length=8,max_length=128)

@app.post("/api/register")
def register(x:Auth,res:Response):
    c=conn()
    try:cur=c.execute("INSERT INTO users(email,password_hash) VALUES(?,?)",(x.email.lower(),hashpw(x.password)))
    except sqlite3.IntegrityError:c.close();raise HTTPException(409,"البريد مسجل مسبقًا")
    c.commit();uid=cur.lastrowid;c.close();login_cookie(uid,res);return {"email":x.email}
@app.post("/api/login")
def login(x:Auth,res:Response):
    c=conn();u=c.execute("SELECT * FROM users WHERE email=?",(x.email.lower(),)).fetchone();c.close()
    if not u or not validpw(x.password,u["password_hash"]):raise HTTPException(401,"البريد أو كلمة المرور غير صحيحة")
    login_cookie(u["id"],res);return {"email":u["email"]}
@app.get("/api/me")
def me(req:Request):return {"user":who(req)}
@app.post("/api/logout")
def logout(req:Request,res:Response):
    t=req.cookies.get("nabeeh_session");c=conn();c.execute("DELETE FROM sessions WHERE token=?",(t,));c.commit();c.close();res.delete_cookie("nabeeh_session");return {"ok":True}

ARTICLES=[
{"id":"sleep","category":"general","label":"الصحة العامة","title":"النوم الكافي يدعم الصحة والتركيز","claim":"النوم الكافي يساعد على تحسين الصحة العامة.","truth":"النوم المنتظم والكافي يدعم التركيز والمزاج والصحة العامة.","method":"مثال تجريبي لعرض طريقة التحقق. ليس مراجعة طبية فعلية.","date":"23 سبتمبر 2026","icon":"☾"},
{"id":"nutrition","category":"nutrition","label":"التغذية","title":"هل يحتاج الجميع إلى مكملات الفيتامينات؟","claim":"كل شخص يحتاج إلى مكملات الفيتامينات يوميًا.","truth":"الحاجة للمكملات تختلف بحسب الغذاء والحالة الصحية.","method":"محتوى تجريبي للواجهة فقط.","date":"18 سبتمبر 2026","icon":"❋"},
{"id":"medicine","category":"medicines","label":"الأدوية","title":"هل يمكن إيقاف الدواء عند الشعور بالتحسن؟","claim":"يمكن إيقاف الدواء بمجرد الشعور بالتحسن.","truth":"لا توقف دواءً موصوفًا دون الرجوع للطبيب أو الصيدلي.","method":"مثال تصميمي وليس نصيحة طبية.","date":"10 سبتمبر 2026","icon":"✚"},
{"id":"fitness","category":"fitness","label":"النشاط البدني","title":"المشي والنشاط البدني المنتظم","claim":"النشاط البدني المنتظم يرتبط بفوائد صحية.","truth":"النشاط البدني المنتظم جزء من نمط الحياة الصحي.","method":"محتوى تجريبي للواجهة فقط.","date":"7 سبتمبر 2026","icon":"↗"}]
@app.get("/api/articles")
def articles():return ARTICLES
@app.get("/api/saved")
def saved(req:Request):
    u=who(req)
    if not u:raise HTTPException(401,"سجّل الدخول")
    c=conn();ids=[r[0] for r in c.execute("SELECT article_id FROM saved WHERE user_id=?",(u["id"],))];c.close()
    return [a for a in ARTICLES if a["id"] in ids]
@app.post("/api/saved/{aid}")
def save(aid:str,req:Request):
    u=who(req)
    if not u:raise HTTPException(401,"سجّل الدخول")
    c=conn();c.execute("INSERT OR IGNORE INTO saved VALUES(?,?)",(u["id"],aid));c.commit();c.close();return {"ok":True}
@app.post("/api/submissions")
def submit(claim:str=Form(...),platform:str=Form(...),source_url:str=Form("")):
    c=conn();cur=c.execute("INSERT INTO submissions(claim,platform,source_url) VALUES(?,?,?)",(claim,platform,source_url));c.commit();rid=cur.lastrowid;c.close()
    return {"id":rid,"message":"تم استلام الادعاء."}
class Chat(BaseModel): message:str=Field(min_length=2,max_length=3000)
def normalize_arabic(value):
    value = unicodedata.normalize("NFKC", str(value or "")).lower()
    value = re.sub(r"[\u064B-\u065F\u0670ـ]", "", value)
    value = re.sub(r"[إأآٱ]", "ا", value).replace("ى", "ي").replace("ة", "ه")
    return re.sub(r"[^\w\s]", " ", value)

CHAT_STOPWORDS = set("""
من في على عن الى الي ان أن أو او و ف ب ك ال هذا هذه ذلك تلك هو هي هل ما ماذا كيف
متى لماذا مع عند بعد قبل كان تكون يكون تم التي الذي اللتي اذا إذا كل بعض اي أي ماهو وشو
لي ليش وش كم هل يمكن ممكن اريد أبي ابغى ابي مقال مقالات معلومة معلومات صحيه
الصحيه الصحة المقال المقاله المقالة نبيه
""".split())

def article_rows():
    # Read article sources without changing either database.
    candidates = [DB, ROOT / "data" / "nabeeh.db"]
    found = []
    seen = set()
    for path in candidates:
        if not path.exists():
            continue
        try:
            c = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True, timeout=2)
            c.row_factory = sqlite3.Row
            tables = [r["name"] for r in c.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )]
            for table in ("moh_articles", "articles"):
                if table not in tables:
                    continue
                columns = [r["name"] for r in c.execute(f'PRAGMA table_info("{table}")')]
                title_col = next((x for x in ("title", "name", "headline") if x in columns), None)
                text_col = next((x for x in ("content", "body", "text", "article_text", "article_content", "article_body", "full_text", "extracted_text", "summary", "description") if x in columns), None)
                url_col = next((x for x in ("url", "source_url", "link") if x in columns), None)
                if not title_col or not text_col:
                    continue
                query = f'SELECT "{title_col}" AS title, "{text_col}" AS content'
                query += f', "{url_col}" AS url' if url_col else ', NULL AS url'
                query += f' FROM "{table}" ORDER BY id DESC LIMIT 500' if "id" in columns else f' FROM "{table}" LIMIT 500'
                for row in c.execute(query).fetchall():
                    title, content, url = row["title"], row["content"], row["url"]
                    if not title or not content:
                        continue
                    key = (str(title).strip(), str(url or "").strip())
                    if key in seen:
                        continue
                    seen.add(key)
                    clean = re.sub(r"<[^>]+>", " ", str(content))
                    clean = re.sub(r"\s+", " ", clean).strip()
                    found.append({"title": str(title).strip(), "content": clean, "url": str(url or "").strip()})
            c.close()
        except (sqlite3.Error, OSError):
            continue
    return found

def arabic_word_forms(word):
    forms = {word}
    for prefix in ("وال", "بال", "كال", "فال", "لل", "ال", "و", "ف", "ب", "ك", "ل"):
        if word.startswith(prefix) and len(word) - len(prefix) >= 3:
            forms.add(word[len(prefix):])
    for form in list(forms):
        if form.startswith("ات") and len(form) >= 5:
            forms.add(form[2:])
    return forms

def expanded_words(text):
    tokens = normalize_arabic(text).split()
    result = set()
    for token in tokens:
        if len(token) > 1:
            result.update(arabic_word_forms(token))
    return result

def short_article_answer(message, articles):
    query_words = [w for w in normalize_arabic(message).split()
                   if len(w) > 1 and w not in CHAT_STOPWORDS]
    query_forms = set()
    for word in query_words:
        query_forms.update(arabic_word_forms(word))
    if not articles:
        return "هذه المعلومة غير موجودة في قاعدة البيانات الحالية."

    scored = []
    for article in articles:
        title_forms = expanded_words(article["title"])
        body_forms = expanded_words(article["content"])
        title_overlap = len(query_forms & title_forms)
        body_overlap = len(query_forms & body_forms)
        score = title_overlap * 4 + body_overlap
        if score:
            scored.append((score, title_overlap, body_overlap, article))
    if not scored:
        return "هذه المعلومة غير موجودة في قاعدة البيانات الحالية."

    scored.sort(key=lambda item: (item[0], item[1], item[2]), reverse=True)
    _, title_overlap, body_overlap, article = scored[0]
    if title_overlap == 0 and body_overlap < 2:
        return "هذه المعلومة غير موجودة في قاعدة البيانات الحالية."

    sentences = [part.strip() for part in re.split(r"(?<=[.!؟])\\s+|(?<=[؛])\\s*", article["content"]) if len(part.strip()) > 25]
    ranked = []
    for sentence in sentences:
        overlap = len(query_forms & expanded_words(sentence))
        ranked.append((overlap, sentence))
    ranked.sort(key=lambda item: item[0], reverse=True)
    chosen = [sentence for overlap, sentence in ranked if overlap > 0][:2]
    if not chosen:
        chosen = sentences[:2]
    if not chosen:
        chosen = [article["content"][:280]]
    answer = " ".join(chosen)
    if len(answer) > 420:
        answer = answer[:417].rsplit(" ", 1)[0] + "..."
    answer = f"بحسب مقال «{article['title']}»: {answer}"
    if article["url"]:
        answer += f"\\nالمصدر: {article['url']}"
    return answer

def relevant_chat_articles(message, articles, limit=3):
    query_words = [w for w in normalize_arabic(message).split()
                   if len(w) > 1 and w not in CHAT_STOPWORDS]
    query_forms = set()
    for word in query_words:
        query_forms.update(arabic_word_forms(word))
    if not query_forms:
        return []

    ranked = []
    for article in articles:
        title_forms = expanded_words(article["title"])
        body_forms = expanded_words(article["content"])
        title_overlap = len(query_forms & title_forms)
        body_overlap = len(query_forms & body_forms)
        # Require a meaningful match so unrelated articles are never sent as evidence.
        if title_overlap >= 1 or body_overlap >= 2:
            score = title_overlap * 5 + body_overlap
            ranked.append((score, article))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [article for _, article in ranked[:limit]]


def gemini_chat_answer(message, articles):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "المساعد الذكي غير مفعّل بعد. أضيفي مفتاح Gemini في ملف .env لتشغيله."

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        evidence = []
        for index, article in enumerate(articles, start=1):
            evidence.append(
                f"[{index}] العنوان: {article['title']}\\n"
                f"المحتوى: {article['content'][:4500]}\\n"
                f"الرابط: {article['url'] or 'غير متوفر'}"
            )
        evidence_text = "\\n\\n".join(evidence) if evidence else "لا توجد مقالات ذات صلة بالسؤال في قاعدة البيانات."
        prompt = f"""أنت مساعد نبيه الصحي. أجب باللغة العربية وبأسلوب بسيط ومختصر يفهمه عامة الناس.
سؤال المستخدم: {message}

مقالات قاعدة البيانات:
{evidence_text}

التعليمات:
- افحص هل أحد المقالات يتناول السؤال نفسه مباشرة، وليس مجرد تشابه كلمات.
- إذا وجدت مقالاً يجيب عن السؤال، لخّص المعلومة منه بدقة ولا تضف ادعاءات طبية غير موجودة فيه.
- إذا لم يوجد مقال يجيب عن السؤال مباشرة، أجب من معرفتك الطبية العامة بإجابة تثق بها، باختصار، ولا تنسبها إلى أي مقال.
- لا تخترع مصادر أو روابط أو أرقامًا مرجعية.
- إذا كان السؤال يتطلب تشخيصًا أو جرعة دواء أو حالة طارئة، وضّح أن المستخدم يحتاج إلى مختص أو رعاية عاجلة حسب الحالة.
- لا تتجاوز 3 جمل قصيرة.
- اكتب أول سطر فقط بصيغة SOURCE: رقم المقال الذي استخدمته (مثلاً SOURCE: 1)، أو SOURCE: NONE إذا كانت الإجابة من المعرفة العامة.
- بعد ذلك اكتب الإجابة فقط، دون عناوين إضافية."""

        response = client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=prompt,
            config={"temperature": 0.2, "max_output_tokens": 300},
        )
        output = (response.text or "").strip()
        if not output:
            return "ما قدرت أجهّز إجابة الآن. حاولي مرة ثانية بعد قليل."

        lines = output.splitlines()
        source_line = lines[0].strip() if lines else ""
        answer = "\n".join(lines[1:]).strip() if source_line.upper().startswith("SOURCE:") else output
        # Remove an occasional stray "N" marker emitted at the start of a model bullet.
        answer = re.sub(r"(?m)^\\s*[-–—]\\s*N\\s*", "", answer)
        answer = re.sub(r"(?m)^\\s*N\\s*[-–—:]\\s*", "", answer)
        if source_line.upper().startswith("SOURCE:"):
            source_value = source_line.split(":", 1)[1].strip()
            if source_value.isdigit():
                index = int(source_value) - 1
                if 0 <= index < len(articles) and articles[index]["url"]:
                    answer += f"\nالمصدر: {articles[index]['url']}"
        return answer or "ما قدرت أجهّز إجابة الآن. حاولي مرة ثانية بعد قليل."
    except Exception:
        return "تعذّر الاتصال بالمساعد الذكي حاليًا. تأكدي من الاتصال بالإنترنت ومفتاح Gemini ثم حاولي مرة ثانية."


@app.post("/api/chat")
def chat(x:Chat):
    articles = relevant_chat_articles(x.message, article_rows())
    return {"answer": gemini_chat_answer(x.message, articles)}

@app.get("/api/profile")
def profile(req:Request):
    u=who(req)
    if not u:raise HTTPException(401,"سجّل الدخول")
    c=conn();r=c.execute("SELECT age,weight,height FROM health WHERE user_id=?",(u["id"],)).fetchone();c.close()
    return {"email":u["email"],"health":dict(r) if r else {}}
@app.put("/api/profile")
def saveprofile(req:Request,age:int|None=None,weight:float|None=None,height:float|None=None):
    u=who(req)
    if not u:raise HTTPException(401,"سجّل الدخول")
    c=conn();c.execute("INSERT INTO health VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET age=excluded.age,weight=excluded.weight,height=excluded.height",(u["id"],age,weight,height));c.commit();c.close();return {"ok":True}
