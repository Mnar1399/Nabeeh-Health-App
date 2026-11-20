# واجهة نبيه المتصلة بالـBackend

هذه النسخة معدّة لتعمل من نفس خادم FastAPI، فلا تحتاجين إلى تشغيل خادم مستقل للواجهة.

## ترتيب المجلدات
ضعي مجلد `nabeeh_frontend` بجانب `backend` و`database` و`scraper`:

```text
nabeeh/
├── backend/
│   └── main.py
├── database/
├── scraper/
└── nabeeh_frontend/
    ├── index.html
    ├── styles.css
    └── app.js
```

## تعديل backend/main.py

لا تستبدلي ملف `main.py` كاملًا؛ احتفظي بمسارات API الموجودة عندك (`/articles` و`/articles/{article_id}` و`/categories`).

1. أضيفي هذه الاستيرادات أعلى الملف:

```python
from pathlib import Path
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
```

2. بعد إنشاء `app = FastAPI(...)` أضيفي مسار مجلد الواجهة:

```python
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "nabeeh_frontend"
```

3. استبدلي دالة الصفحة الرئيسية الحالية:

```python
@app.get("/")
def home():
    return {
        "message": "Welcome to Nabeeh API",
        "status": "Running"
    }
```

بهذه الدالة:

```python
@app.get("/")
def home():
    return FileResponse(FRONTEND_DIR / "index.html")
```

4. في آخر الملف تمامًا، بعد جميع مسارات API، أضيفي:

```python
app.mount(
    "/",
    StaticFiles(directory=str(FRONTEND_DIR)),
    name="frontend"
)
```

مهم: يجب أن يكون `app.mount("/")` في آخر الملف بعد تعريف جميع مسارات API حتى لا يحجبها.

## التشغيل

من المجلد الرئيسي `nabeeh` شغّلي أمرًا واحدًا:

```powershell
python -m uvicorn backend.main:app --reload
```

ثم افتحي:

- التطبيق: http://127.0.0.1:8000
- توثيق الـAPI: http://127.0.0.1:8000/docs
- المقالات: http://127.0.0.1:8000/articles

أوقفي الخادم باستخدام `Ctrl + C`.

## ما الذي تم تغييره في الواجهة؟

في `app.js` أصبح عنوان الـAPI نسبيًا (`""`)؛ لذلك ستطلب الواجهة `/articles` من نفس الخادم الذي يعرض ملفاتها. لا يلزم CORS عند تشغيلها بهذه الطريقة.

## تنبيه

زر التحقق من الادعاءات ما زال واجهة فقط؛ لا يصدر حكمًا صحيًا حقيقيًا إلى أن نضيف خدمة تحقق موثوقة متصلة بمصادر صحية. كذلك يجب أن تكون قاعدة البيانات تحتوي على مقالات ذات محتوى كافٍ حتى تظهر في الصفحة.
