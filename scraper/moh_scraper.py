import requests
import sqlite3
import hashlib
import time
from pathlib import Path
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser
from bs4 import BeautifulSoup

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "nabeeh.db"

HEADERS = {
    "User-Agent": "NabeehStudentProject/1.0 (educational research)"
}

def get_source_id(connection, url):
    """Find the source already registered in the database."""
    page_host = urlparse(url).netloc.replace("www.", "")

    sources = connection.execute(
        "SELECT id, base_url FROM sources WHERE is_active = 1"
    ).fetchall()

    for source in sources:
        source_host = urlparse(source["base_url"]).netloc.replace("www.", "")
        if page_host == source_host or page_host.endswith("." + source_host):
            return source["id"]

    return None


def is_allowed(url):
    """Check robots.txt before requesting a page."""
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

    try:
        response = requests.get(
            robots_url, headers=HEADERS, timeout=15
        )
        response.raise_for_status()

        parser = RobotFileParser()
        parser.set_url(robots_url)
        parser.parse(response.text.splitlines())

        return parser.can_fetch(HEADERS["User-Agent"], url)

    except requests.RequestException:
        print("Could not check robots.txt. Skipping this page.")
        return False


def scrape_page(url):
    if not is_allowed(url):
        print("Not allowed or robots.txt could not be checked:", url)
        return

    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row

    source_id = get_source_id(connection, url)

    if source_id is None:
        print("This website is not registered in the sources table.")
        connection.close()
        return

    try:
        response = requests.get(url, headers=HEADERS, timeout=20)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Remove page elements that are not article content
        for element in soup(["script", "style", "nav", "footer", "header"]):
            element.decompose()

        title_tag = soup.find("h1") or soup.find("title")
        title = title_tag.get_text(" ", strip=True) if title_tag else ""

        description_tag = soup.find(
            "meta", attrs={"name": "description"}
        )
        description = (
            description_tag.get("content", "").strip()
            if description_tag else ""
        )

        # Collect a short text sample for the initial test
        paragraphs = soup.find_all("p")
        text_sample = " ".join(
            p.get_text(" ", strip=True) for p in paragraphs
        )
        text_sample = text_sample[:3000]

        if not title:
            print("No article title found. Skipping:", url)
            connection.close()
            return

        content_hash = hashlib.sha256(
            (title + url).encode("utf-8")
        ).hexdigest()

        connection.execute(
            """
            INSERT INTO articles
            (source_id, title, content, url, language, content_hash, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)

            ON CONFLICT(url) DO UPDATE SET
                title = excluded.title,
                content = excluded.content,
                language = excluded.language,
                content_hash = excluded.content_hash
            """,
            (
                source_id,
                title,
                text_sample or description,
                url,
                "ar" if any("\u0600" <= char <= "\u06FF" for char in title) else "en",
                content_hash,
                "pending"
            )
        )

        connection.commit()

        print("Processed:", title)
        print("Saved new article." if connection.total_changes else "Article already exists.")

    except requests.RequestException as error:
        print("Page request failed:", error)

    finally:
        connection.close()


if __name__ == "__main__":
    article_url = input("Paste one article URL: ").strip()
    scrape_page(article_url)