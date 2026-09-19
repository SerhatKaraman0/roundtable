import re
from pathlib import Path

KNOWLEDGE_BASE_PATH = Path(__file__).parent.parent / "data" / "knowledge_base"
BAKUNIN_PATH = KNOWLEDGE_BASE_PATH / "bakunin"
MARX_PATH = KNOWLEDGE_BASE_PATH / "marx"
MILL_PATH = KNOWLEDGE_BASE_PATH / "mill"

# Known authors from your knowledge base folders
KNOWN_AUTHORS = {
    "bakunin": ["bakunin"],
    "marx": ["marx", "engels"],
    "mill": ["mill", "john stuart mill"],
}

DATA_ROOT = KNOWLEDGE_BASE_PATH.parent
VECTOR_STORE_ROOT = Path(__file__).parent.parent.parent / "data" / "vector_stores"

TESTSET_PATH = DATA_ROOT / "eval" / "testsets" / "gemini_testset.jsonl"
CACHED_DATASETS_DIR = DATA_ROOT / "eval" / "cached_datasets"
RESULTS_DIR = DATA_ROOT / "eval" / "results"
FAILED_DIR = RESULTS_DIR / "failed"

VECTOR_STORE_DIRS = {
    "basic": VECTOR_STORE_ROOT / "basic_chroma_db",
    "ensemble": VECTOR_STORE_ROOT / "ensemble_chroma_db",
}


def normalize_question_text(value: str) -> str:
    if not value:
        return ""
    normalized = value.lower()
    normalized = normalized.replace("&", " and ")
    normalized = normalized.replace("_", " ")
    normalized = normalized.replace("-", " ")
    normalized = normalized.replace("’", "'")
    normalized = normalized.replace("\u2014", " ")
    normalized = normalized.replace("\u2013", " ")
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def detect_titles(question: str, known_titles: list[str] | None = None) -> list[str]:
    if not known_titles:
        return []
    q_norm = normalize_question_text(question)
    matches = []
    for title in sorted(known_titles, key=len, reverse=True):
        if not title:
            continue
        title_norm = normalize_question_text(title)
        if not title_norm:
            continue
        if title_norm in q_norm or q_norm in title_norm:
            matches.append(title)
            continue
        title_tokens = set(title_norm.split())
        q_tokens = set(q_norm.split())
        if title_tokens and title_tokens.issubset(q_tokens):
            matches.append(title)
    return matches


def detect_authors(question: str) -> list[str]:
    q = question.lower()
    found = [author for author, aliases in KNOWN_AUTHORS.items() if any(alias in q for alias in aliases)]
    return found


def author_filtered_retrieve(vector_store, question: str, k_total: int = 6, known_titles: list[str] | None = None) -> list:
    authors = detect_authors(question)
    titles = detect_titles(question, known_titles or [])

    if not authors:
        return vector_store.similarity_search(question, k=k_total)

    k_per_author = max(1, k_total // len(authors))
    docs = []
    seen_ids = set()

    for author in authors:
        author_found_via_title = False

        if titles:
            for title in titles:
                results = vector_store.similarity_search(
                    question,
                    k=k_per_author,
                    filter={"$and": [{"author": author}, {"title": title}]},
                )
                for doc in results:
                    doc_id = doc.metadata.get("id")
                    if doc_id not in seen_ids:
                        docs.append(doc)
                        seen_ids.add(doc_id)
                        author_found_via_title = True

        if author_found_via_title:
            continue  # this author's title-scoped search succeeded, skip its fallback

        # fallback: author-only search, only for authors whose title search
        # found nothing (or who had no title detected at all)
        for doc in vector_store.similarity_search(question, k=k_per_author, filter={"author": author}):
            doc_id = doc.metadata.get("id")
            if doc_id not in seen_ids:
                docs.append(doc)
                seen_ids.add(doc_id)

    if not docs:
        return vector_store.similarity_search(question, k=k_total)

    return docs
