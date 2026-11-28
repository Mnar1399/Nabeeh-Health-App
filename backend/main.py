import os, sqlite3, hashlib, secrets, re, unicodedata
from pathlib import Path
from fastapi import FastAPI, Request, Response, HTTPException, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field
ROOT=Path(__file__).resolve().parent.parent
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
    res.set_cookie("nabeeh_session",t,httponly=True,samesite="lax",max_age=1209600)

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
    return {"id":rid,"message":"تم استلام الادعاء وحفظه في النموذج التجريبي. إعداد البريد مطلوب لإرسال إشعار."}
class Chat(BaseModel): message:str=Field(min_length=2,max_length=3000)
def normalize_arabic(value):
    value = unicodedata.normalize("NFKC", str(value or "")).lower()
    value = re.sub(r"[\u064B-\u065F\u0670ـ]", "", value)
    value = re.sub(r"[إأآٱ]", "ا", value).replace("ى", "ي").replace("ة", "ه")
    return re.sub(r"[^\w\s]", " ", value)

CHAT_STOPWORDS = set("""
من في على عن الى الي ان أن أو او و ف ب ك ال هذا هذه ذلك تلك هو هي هل ما ماذا كيف
متى لماذا مع عند بعد قبل كان تكون يكون تم التي الذي اللتي اذا إذا كل بعض اي أي
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
                text_col = next((x for x in ("content", "body", "text", "article_text", "summary", "description") if x in columns), None)
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

def short_article_answer(message, articles):
    words = [w for w in normalize_arabic(message).split()
             if len(w) > 1 and w not in CHAT_STOPWORDS]
    if not articles:
        return "قاعدة البيانات ما فيها مقالات صحية جاهزة للقراءة حتى الآن. أضيفوا مقالات وزارة الصحة أولًا، وبعدها أقدر أجاوب منها."

    scored = []
    for article in articles:
        title_words = set(normalize_arabic(article["title"]).split())
        body_words = set(normalize_arabic(article["content"]).split())
        score = sum(3 for w in words if w in title_words) + sum(1 for w in words if w in body_words)
        if score:
            scored.append((score, article))
    if not scored:
        return "ما لقيت في قاعدة البيانات مقالًا يطابق سؤالك بشكل واضح. جرّب تكتب اسم الموضوع أو عنوان المقال."

    scored.sort(key=lambda item: item[0], reverse=True)
    best_score, article = scored[0]
    sentences = [s.strip() for s in re.split(r"(?<=[.!؟])\s+|(?<=[؛])\s*", article["content"]) if len(s.strip()) > 25]
    query_terms = set(words)
    ranked_sentences = []
    for sentence in sentences:
        sentence_words = set(normalize_arabic(sentence).split())
        overlap = len(query_terms & sentence_words)
        ranked_sentences.append((overlap, sentence))
    ranked_sentences.sort(key=lambda item: item[0], reverse=True)
    chosen = [s for overlap, s in ranked_sentences if overlap > 0][:2]
    if not chosen:
        chosen = sentences[:2]
    if not chosen:
        chosen = [article["content"][:280]]
    answer = " ".join(chosen)
    if len(answer) > 420:
        answer = answer[:417].rsplit(" ", 1)[0] + "..."
    answer = f"بحسب مقال «{article['title']}»: {answer}"
    if article["url"]:
        answer += f"\nالمصدر: {article['url']}"
    return answer

@app.post("/api/chat")
def chat(x:Chat):
    articles = article_rows()
    return {"answer": short_article_answer(x.message, articles)}

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
