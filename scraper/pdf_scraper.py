
import requests
import sqlite3
import hashlib
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse
from pypdf import PdfReader

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "nabeeh.db"

HEADERS = {
    "User-Agent": "NabeehStudentProject/1.0 (educational research)"
}


def scrape_pdf(url, title):
    print(f"\nReading PDF: {title}")

    # 1. Download the PDF
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()

    # 2. Read the PDF and extract its text
    pdf = PdfReader(BytesIO(response.content))

    pages_text = []

    for page in pdf.pages:
        text = page.extract_text()

        if text:
            pages_text.append(text)

    content = "\n".join(pages_text).strip()

    if not content:
        print("No text found in this PDF.")
        return

    # 3. Calculate a hash to identify the content
    content_hash = hashlib.sha256(
        content.encode("utf-8")
    ).hexdigest()

    # 4. Detect the language
    language = "ar" if any(
        "\u0600" <= char <= "\u06FF" for char in content
    ) else "en"

    # 5. Find the source ID
    hostname = urlparse(url).hostname

    connection = sqlite3.connect(DB_PATH)

    source = connection.execute(
        "SELECT id FROM sources WHERE base_url LIKE ?",
        (f"%{hostname}%",)
    ).fetchone()

    if source is None:
        connection.close()
        print("Source not found in database.")
        return

    source_id = source[0]

    # 6. Save the PDF content in the articles table
    connection.execute("""
        INSERT INTO articles
        (source_id, title, content, url, language, content_hash, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')

        ON CONFLICT(url) DO UPDATE SET
            title = excluded.title,
            content = excluded.content,
            language = excluded.language,
            content_hash = excluded.content_hash
    """, (
        source_id,
        title,
        content,
        url,
        language,
        content_hash
    ))

    connection.commit()
    connection.close()

    print("PDF saved successfully!")
    print("Pages:", len(pdf.pages))
    print("Content length:", len(content))
