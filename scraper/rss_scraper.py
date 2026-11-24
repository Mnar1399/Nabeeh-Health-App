import feedparser
import sqlite3
import hashlib
from pathlib import Path
from urllib.parse import urlparse

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "nabeeh.db"

RSS_FEEDS = [
    "https://www.moh.gov.sa/_layouts/15/moh/RssGenerator.aspx?WebSiteUrl=/HealthAwareness/EducationalContent/HealthTips/&ListUrl=/HealthAwareness/EducationalContent/HealthTips/Pages/&ViewName=RSSView&RssTitle=&RssDescription=BriefDesc"
]


def get_source_id(connection, feed_url):
    feed_host = urlparse(feed_url).netloc.replace("www.", "")

    sources = connection.execute(
        "SELECT id, base_url FROM sources WHERE is_active = 1"
    ).fetchall()

    for source in sources:
        source_host = urlparse(source["base_url"]).netloc.replace("www.", "")
        if feed_host == source_host or feed_host.endswith("." + source_host):
            return source["id"]

    return None


def collect_rss():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row

    discovered_links = []

    for feed_url in RSS_FEEDS:
        if not feed_url.startswith("https://"):
            continue

        print("\nReading RSS:", feed_url)

        source_id = get_source_id(connection, feed_url)

        if source_id is None:
            print("RSS source is not registered in the database.")
            continue

        feed = feedparser.parse(feed_url)

        if feed.bozo:
            print("Warning: The RSS feed may have a parsing problem.")

        for entry in feed.entries:
            title = entry.get("title", "").strip()
            link = entry.get("link", "").strip()
            summary = entry.get("summary", "").strip()

            if not title or not link:
                continue

            content_hash = hashlib.sha256(
                (title + link).encode("utf-8")
            ).hexdigest()

            connection.execute(
                """
                INSERT INTO articles
                (source_id, title, content, url, language, category, content_hash, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(url) DO UPDATE SET
                    title = excluded.title,
                    content = CASE
                        WHEN length(trim(COALESCE(articles.content, ''))) < length(trim(COALESCE(excluded.content, '')))
                        THEN excluded.content ELSE articles.content END,
                    language = excluded.language,
                    category = excluded.category,
                    content_hash = excluded.content_hash
                """,
                (
                    source_id,
                    title,
                    summary[:3000],
                    link,
                    "ar" if any("\\u0600" <= char <= "\\u06FF" for char in title) else "en",
                    "محتوى صحي",
                    content_hash,
                    "pending"
                )
            )

            discovered_links.append(link)
            print("Found:", title)

    connection.commit()
    connection.close()

    return discovered_links


if __name__ == "__main__":
    links = collect_rss()
    print("\nTotal links discovered:", len(links))