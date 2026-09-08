import requests
import ebooklib
from bs4 import BeautifulSoup
from pathlib import Path
from ebooklib import epub 

save_loc = Path(__file__).parent.parent / "data" / "knowledge_base"

def _epub_to_clean_text(epub_path: str, output_txt: str):
    book = epub.read_epub(epub_path)
    lines = []

    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        soup = BeautifulSoup(item.get_body_content(), "html.parser")
        text = soup.get_text(separator="\n")
        # Clean extra whitespace
        cleaned = "\n".join(
            line.strip() for line in text.splitlines() if line.strip()
        )
        if cleaned:
            lines.append(cleaned)

    with open(output_txt, "w", encoding="utf-8") as f:
        f.write("\n\n".join(lines))

def ingest_marx():
    marx_save_loc = save_loc / "marx"

    book_list = list(marx_save_loc.iterdir())
    
    for item in book_list:
        new_book_name = item.stem + ".txt"
        new_loc = marx_save_loc / new_book_name
        _epub_to_clean_text(item, new_loc)
        
def ingest_bakunin():
    hrefs = []
    bakunin_save_loc = save_loc /  "bakunin"

    for i in range(1, 4):
        response = requests.get(f"https://theanarchistlibrary.org/category/author/mikhail-bakunin?page={i}")

        soup = BeautifulSoup(response.content, "html.parser")

        href = [
            a.get("href")
            for a in soup.find_all("a", class_="list-group-item clearfix")
            if a.get("href")
        ]

        hrefs.extend(href)

    print(f"Len of links at page {i}: {len(hrefs)}")

    for link in hrefs:
        response = requests.get(link + ".muse")
        soup = BeautifulSoup(response.content, "html.parser")
        text = soup.get_text(separator="\n", strip=True)

        name = link.split("/")[-1].split(".")[0] + ".txt"
        path = Path(bakunin_save_loc) / name

        with open(path, "w", encoding="utf-8") as f:
            f.write(text)

def ingest_mill():
    base_url = "https://www.gutenberg.org"
    author = "/ebooks/author/1705"

    response = requests.get(base_url + author)

    soup = BeautifulSoup(response.content, "html.parser")

    hrefs = [
        a.get("href")
        for a in soup.find_all("a", class_="link")
        if a.get("href") and "ebooks" in a.get("href")
    ]
    
    for link in hrefs:
        book_link = base_url + link

        response = requests.get(book_link + ".txt.utf-8")
        soup = BeautifulSoup(response.content, "html.parser")

        book_response = requests.get(book_link)
        book_name_soup = BeautifulSoup(book_response.content, "html.parser")
        
        text = soup.get_text(separator="\n", strip=True)
        book_name = book_name_soup.find("td", itemprop="headline").get_text(strip=True) + ".txt"

        mill_save_loc = save_loc / "mill"
        path = mill_save_loc / book_name

        with open(path, "w", encoding="utf-8") as f:
            f.write(text)


if __name__ == "__main__":
    ingest_marx()
