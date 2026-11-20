from rss_scraper import collect_rss
from moh_scraper import scrape_page

def run_all():
    print("Starting Nabeeh data collection...")

    # First: discover article links using RSS
    links = collect_rss()

    print("\nRSS collection completed.")
    print("Discovered links:", len(links))

    # Second: visit the discovered pages using Web Scraping
    for link in links:
        print("\nScraping article:", link)
        scrape_page(link)

    print("\nNabeeh collection process finished!")


if __name__ == "__main__":
    run_all()