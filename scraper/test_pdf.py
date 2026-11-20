
import sys
from pathlib import Path

# Add the main project folder to Python's search path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pdf_scraper import scrape_pdf
from database.db import get_connection

url = "https://www.moh.gov.sa/HealthAwareness/EducationalContent/HealthTips/Documents/2018-11-13-001.pdf"

title = "إرشادات عامة بعد الخياطة (الغرز الجراحية)"

scrape_pdf(url, title)

connection = get_connection()

article = connection.execute(
    "SELECT content FROM articles WHERE url = ?",
    (url,)
).fetchone()

print("\nExtracted PDF Text:")
print(article["content"] if article else "Article not found")

connection.close()
