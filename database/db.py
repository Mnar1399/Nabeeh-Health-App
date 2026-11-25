
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "nabeeh.db"


def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row

    return connection


def create_tables():
    connection = get_connection()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            base_url TEXT NOT NULL UNIQUE,
            description TEXT,
            is_active INTEGER DEFAULT 1
        )
    """)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            url TEXT NOT NULL UNIQUE,
            category TEXT,
            language TEXT DEFAULT 'en',
            published_at TEXT,
            scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
            content_hash TEXT,
            status TEXT DEFAULT 'pending',

            FOREIGN KEY (source_id)
            REFERENCES sources(id)
        )
    """)

    connection.commit()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            claim TEXT NOT NULL,
            platform TEXT NOT NULL,
            source_url TEXT,
            image_data TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    connection.close()


def add_source(name, base_url, description):
    connection = get_connection()

    connection.execute(
        """
        INSERT OR IGNORE INTO sources
        (name, base_url, description)
        VALUES (?, ?, ?)
        """,
        (name, base_url, description)
    )

    connection.commit()
    connection.close()


def show_sources():
    connection = get_connection()

    sources = connection.execute(
        "SELECT * FROM sources"
    ).fetchall()

    for source in sources:
        print(dict(source))

    connection.close()


if __name__ == "__main__":
    create_tables()

    add_source(
        "Saudi Ministry of Health",
        "https://www.moh.gov.sa/",
        "Official Saudi health information"
    )

    add_source(
        "World Health Organization",
        "https://www.who.int/",
        "International health information"
    )

    add_source(
        "CDC",
        "https://www.cdc.gov/",
        "Public health information"
    )

    #show_sources()

def show_articles():
    connection = get_connection()

    articles = connection.execute("""
        SELECT id, title, content, url
        FROM articles
        ORDER BY id
    """).fetchall()

    for article in articles:
        print("\n" + "=" * 60)
        print("Article ID:", article["id"])
        print("Title:", article["title"])
        print("URL:", article["url"])
        print("\nExtracted Content:")
        print(article["content"])
        print("\nContent Length:", len(article["content"] or ""))

    connection.close()

if __name__ == "__main__":
    show_articles()