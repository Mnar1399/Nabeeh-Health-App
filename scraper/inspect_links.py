import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

URL = "https://www.moh.gov.sa/HealthAwareness/EducationalContent/HealthTips/Pages/006.aspx"

HEADERS = {
    "User-Agent": "NabeehStudentProject/1.0"
}

response = requests.get(
    URL,
    headers=HEADERS,
    timeout=20
)

response.raise_for_status()

soup = BeautifulSoup(response.text, "html.parser")

print("PDF files found:")
print("-" * 50)

for link in soup.find_all("a", href=True):
    href = link["href"]

    if ".pdf" in href.lower():
        pdf_url = urljoin(URL, href)
        title = link.get_text(" ", strip=True)

        print("Title:", title)
        print("PDF URL:", pdf_url)
        print("-" * 50)