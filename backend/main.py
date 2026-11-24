
from fastapi import FastAPI, HTTPException
from database.db import get_connection, create_tables
from pathlib import Path
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="Nabeeh API",
    description="Backend API for Nabeeh Health Application",
    version="1.0.0"
)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

# Make sure database tables exist
create_tables()


@app.get("/")
def home():
    return FileResponse(FRONTEND_DIR / "index.html")
    


# Get all health articles
@app.get("/articles")
def get_articles():
    connection = get_connection()

    try:
        articles = connection.execute("""
            SELECT
                id,
                title,
                category,
                language,
                published_at,
                url,
                status
            FROM articles
            WHERE content IS NOT NULL
            AND length(trim(content)) > 50
            ORDER BY id DESC
        """).fetchall()

        return [dict(article) for article in articles]

    finally:
        connection.close()


# Get one article by its ID
@app.get("/articles/{article_id}")
def get_article(article_id: int):
    connection = get_connection()

    try:
        article = connection.execute(
            "SELECT * FROM articles WHERE id = ?",
            (article_id,)
        ).fetchone()

        if article is None:
            raise HTTPException(
                status_code=404,
                detail="Article not found"
            )

        return dict(article)

    finally:
        connection.close()


# Get available health categories
@app.get("/trends")
def get_health_trends():
    """Return recent health items collected from the configured official RSS feeds."""
    connection = get_connection()
    try:
        rows = connection.execute("""
            SELECT
                a.id,
                a.title,
                a.content,
                a.url,
                a.language,
                a.scraped_at,
                s.name AS source_name
            FROM articles AS a
            JOIN sources AS s ON s.id = a.source_id
            WHERE s.base_url LIKE '%moh.gov.sa%'
              AND a.content IS NOT NULL
              AND length(trim(a.content)) > 40
            ORDER BY a.scraped_at DESC, a.id DESC
            LIMIT 30
        """).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


@app.get("/categories")
def get_categories():
    connection = get_connection()

    try:
        categories = connection.execute("""
            SELECT DISTINCT category
            FROM articles
            WHERE category IS NOT NULL
            AND TRIM(category) != ''
        """).fetchall()

        return [
            item["category"] for item in categories
        ]

    finally:
        connection.close()

app.mount(
    "/",
    StaticFiles(directory=str(FRONTEND_DIR)),
    name="frontend"
)