
import os
import json
import requests
from datetime import datetime

from database.db import get_connection

from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"

load_dotenv(dotenv_path=ENV_PATH, override=True)

API_KEY = os.getenv("OPENAI_API_KEY", "").strip()

if not API_KEY:
    raise ValueError("OPENAI_API_KEY not found in .env file")


def summarize_article(article):
    """Generate a simple Arabic summary using OpenAI API."""

    prompt = f"""
أنت مساعد متخصص في تبسيط المعلومات الصحية للجمهور العام.

اقرأ المقال التالي، ثم أعد النتيجة باللغة العربية السهلة.

التعليمات:
1. استخدم المعلومات الموجودة في المقال فقط.
2. لا تضف معلومات أو نصائح طبية من عندك.
3. حافظ على المعنى الطبي الأصلي.
4. اكتب ملخصًا واضحًا من 3 إلى 5 جمل.
5. استخرج من 3 إلى 5 نقاط مهمة.
6. اشرح المصطلحات المعقدة بلغة بسيطة.
7. إذا كانت المعلومات غير كافية، وضّح ذلك.

أعد النتيجة بصيغة JSON فقط:
{{
    "summary": "الملخص المبسط",
    "key_points": [
        "النقطة الأولى",
        "النقطة الثانية",
        "النقطة الثالثة"
    ]
}}

عنوان المقال:
{article["title"]}

نص المقال:
{article["content"]}
"""

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": "gpt-4o-mini",
            "messages": [
                {
                    "role": "system",
                    "content": "أنت مساعد لتلخيص المحتوى الصحي بدقة وأمانة."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
            "max_tokens": 700
        },
        timeout=90
    )

    if not response.ok:
        raise RuntimeError(
            f"OpenAI API error ({response.status_code}): "
            f"{response.text[:1000]}"
        )

    result = response.json()
    content = result["choices"][0]["message"]["content"]

    data = json.loads(content)

    summary = data.get("summary")
    key_points = data.get("key_points")

    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("AI returned an empty summary.")

    if not isinstance(key_points, list) or not 3 <= len(key_points) <= 5:
        raise ValueError("AI returned invalid key points.")

    if not all(isinstance(point, str) and point.strip() for point in key_points):
        raise ValueError("AI returned an invalid key point.")

    return summary.strip(), key_points


def summarize_pending_articles():
    connection = get_connection()

    try:
        articles = connection.execute("""
            SELECT id, title, content
            FROM articles
            WHERE content IS NOT NULL
            AND length(trim(content)) > 50
            AND summary_status IN ('pending', 'failed')
            AND (summary IS NULL OR trim(summary) = '')
            ORDER BY id ASC
            LIMIT 1
        """).fetchall()

        print(f"Articles waiting for summaries: {len(articles)}")

        for article in articles:
            article = dict(article)

            print(
                f"\nSummarizing article {article['id']}: "
                f"{article['title']}"
            )

            try:
                summary, key_points = summarize_article(article)

                connection.execute("""
                    UPDATE articles
                    SET summary = ?,
                        key_points = ?,
                        summary_status = 'completed',
                        summary_updated_at = ?
                    WHERE id = ?
                """, (
                    summary,
                    json.dumps(key_points, ensure_ascii=False),
                    datetime.now().isoformat(timespec="seconds"),
                    article["id"]
                ))

                connection.commit()
                print("Summary saved successfully!")

            except Exception as error:
                connection.execute("""
                    UPDATE articles
                    SET summary_status = 'failed'
                    WHERE id = ?
                """, (article["id"],))

                connection.commit()
                print(f"Could not summarize article: {error}")

    finally:
        connection.close()


if __name__ == "__main__":
    summarize_pending_articles()
