import re
from pathlib import Path
import warnings

warnings.filterwarnings("ignore")

GUTENBERG_START_RE = re.compile(
    r"\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*",
    re.IGNORECASE | re.DOTALL,
)
GUTENBERG_END_RE = re.compile(
    r"\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*",
    re.IGNORECASE | re.DOTALL,
)
# Header metadata block that sits between the file start and the START marker
# (Title:, Author:, Release date:, Credits:, Language:, etc.)
GUTENBERG_HEADER_FIELD_RE = re.compile(
    r"^(Title|Author|Release date|Language|Credits|Most recently updated|"
    r"Other information and formats|Produced by)\s*:.*$",
    re.IGNORECASE | re.MULTILINE,
)

TITLE_LINE_RE = re.compile(r"^Title:\s*(.+)$", re.IGNORECASE | re.MULTILINE)

# Optional manual overrides for filenames whose slug/title extraction is clearly wrong.
# Keep this dict small and explicit so you can review/adjust the mapping before pipeline use.
TITLE_OVERRIDES: dict[str, str] = {
    "michail-bakunin-the-rules-and-program-of-the-international-alliance-of-socialist-democracy-foun.txt": "The Rules and Program of the International Alliance of Socialist Democracy Founded on the 20th September 1868",
    "michail-bakunin-to-the-comrades-of-the-international-workingmen-s-association-of-locle-and-chau.txt": "To the Comrades of the International Workingmen's Association of Locle and Chaux-de-Fonds",
    "mikhail-bakunin-to-the-compagnons-of-the-international-workingmen-s-association-of-locle-and-la.txt": "To the Compagnons of the International Workingmen's Association of Locle and La Chaux-de-Fonds",
}

EXCLUDED_FILE_NAMES = {
    "alfredo-bonanno-anarchism-and-the-national-liberation-struggle.txt",
    "anthony-j-nocella-ii-mark-seis-and-jeff-shantz-classic-writings-in-anarchist-criminology.txt",
    "max-nettlau-contributions-to-the-biography-of-mikhail-bakunin.txt",
    "maximoff-the-political-philosophy-of-bakunin.txt",
    "saint-imier-congress-resolutions-of-the-saint-imier-congress.txt",
}

NON_CONTENT_KEYWORDS = (
    "index",
    "contents",
    "table of contents",
    "toc",
    "gutenberg",
    "copyright",
    "listing",
    "intro",
    "about this ebook",
)

SHORT_WORDS = {
    "a",
    "an",
    "and",
    "as",
    "at",
    "but",
    "by",
    "for",
    "from",
    "in",
    "of",
    "on",
    "or",
    "the",
    "to",
    "vs",
    "with",
}


def strip_gutenberg_boilerplate(text: str) -> str:
    # Cut everything from the START marker backwards (drop header block)
    start_match = GUTENBERG_START_RE.search(text)
    if start_match:
        text = text[start_match.end() :]

    # Cut everything from the END marker onwards (drop footer/license block)
    end_match = GUTENBERG_END_RE.search(text)
    if end_match:
        text = text[: end_match.start()]

    # Catch stray header-style lines that weren't inside a START/END pair
    # (some Gutenberg files put "Title: ..." etc. above the START marker only)
    text = GUTENBERG_HEADER_FIELD_RE.sub("", text)

    return text.strip()


def _title_case_preserve_short_words(value: str) -> str:
    tokens = value.strip().split()
    title_tokens = []
    for i, token in enumerate(tokens):
        cleaned = token.strip(".,;:()[]{}'\"")
        if not cleaned:
            continue
        if i == 0 or cleaned.lower() not in SHORT_WORDS:
            title_tokens.append(cleaned[:1].upper() + cleaned[1:])
        else:
            title_tokens.append(cleaned.lower())
    return " ".join(title_tokens)


def fix_possessive_s(value: str) -> str:
    if not value:
        return value
    fixed = re.sub(r"(?i)\b([A-Za-z]+)\s+S\b", r"\1's", value)
    fixed = re.sub(r"(?i)\b([A-Za-z]+)\s+S\s+(?=[A-Z])", r"\1's ", fixed)
    return fixed


def normalize_title_for_matching(value: str) -> str:
    if not value:
        return ""
    normalized = fix_possessive_s(value.strip())
    normalized = normalized.replace("&", " and ")
    normalized = normalized.replace("_", " ")
    normalized = normalized.replace("-", " ")
    normalized = re.sub(r"(?i)\b(v|vol|volume)\s*0*([1-9][0-9]*)\b", r"volume \2", normalized)
    normalized = re.sub(r"(?i)\bv0*([1-9][0-9]*)\b", r"volume \1", normalized)
    normalized = re.sub(r"[^a-zA-Z0-9\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip().lower()
    return normalized


def normalize_title_for_dedupe(value: str) -> str:
    if not value:
        return ""
    normalized = fix_possessive_s(value.strip())
    normalized = normalized.replace("&", " and ")
    normalized = normalized.replace("_", " ")
    normalized = normalized.replace("-", " ")
    normalized = re.sub(r"(?i)^(?:michail|mikhail|michael)\s*(?:bakunin\s*)?", "", normalized)
    normalized = re.sub(r"(?i)^(?:john\s+stuart\s+)?mill\s+", "", normalized)
    normalized = re.sub(r"(?i)^(?:karl\s+)?marx\s+", "", normalized)
    normalized = re.sub(r"(?i)\b(v|vol|volume)\s*0*([1-9][0-9]*)\b", r"volume \2", normalized)
    normalized = re.sub(r"(?i)\bv0*([1-9][0-9]*)\b", r"volume \1", normalized)
    normalized = re.sub(r"[^a-zA-Z0-9\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip().lower()
    return normalized


def derive_title_from_filename(filename: str | Path) -> str:
    stem = Path(filename).stem if isinstance(filename, Path) else Path(str(filename)).stem
    if not stem:
        return "Unknown"

    candidate = stem.replace("_", " ").replace("-", " ")
    candidate = fix_possessive_s(candidate)
    candidate = re.sub(r"(?i)^(?:michail|mikhail|michael)\s*(?:bakunin\s*)?", "", candidate)
    candidate = re.sub(r"(?i)^(?:john\s+stuart\s+)?mill\s+", "", candidate)
    candidate = re.sub(r"(?i)^(?:karl\s+)?marx\s+", "", candidate)
    candidate = re.sub(r"(?i)\b(v|vol|volume)\s*0*([1-9][0-9]*)\b", r"Volume \2", candidate)
    candidate = re.sub(r"(?i)\bv0*([1-9][0-9]*)\b", r"Volume \1", candidate)
    candidate = re.sub(r"\s+", " ", candidate).strip()
    if not candidate:
        return "Unknown"
    return _title_case_preserve_short_words(candidate)


def extract_title_from_text_or_filename(path: Path, raw_text: str | None = None) -> str:
    text = raw_text or path.read_text(encoding="utf-8", errors="ignore")

    title_match = TITLE_LINE_RE.search(text)
    if title_match:
        derived = fix_possessive_s(title_match.group(1).strip())
        if derived:
            return TITLE_OVERRIDES.get(path.name, derived)

    derived = derive_title_from_filename(path)
    return TITLE_OVERRIDES.get(path.name, TITLE_OVERRIDES.get(derived, derived))


def is_probably_non_content_file(path: Path) -> bool:
    if path.suffix.lower() != ".txt":
        return True
    name = path.name.lower()
    if any(keyword in name for keyword in NON_CONTENT_KEYWORDS):
        return True
    return False


def iter_author_text_files(author_dir: Path) -> list[Path]:
    files = []
    seen: dict[str, Path] = {}

    for path in sorted(author_dir.rglob("*.txt")):
        if path.name in EXCLUDED_FILE_NAMES:
            continue
        if is_probably_non_content_file(path):
            continue

        text = path.read_text(encoding="utf-8", errors="ignore")
        if not text.strip():
            continue

        title = extract_title_from_text_or_filename(path, text)
        key = normalize_title_for_dedupe(title)
        if not key:
            continue

        # Exclude duplicate/near-duplicate editions that do not meaningfully differ
        # in how eval questions reference the work. We keep volume-distinct files
        # such as Marx's capital-v1.txt through capital-v4.txt separate because the
        # volume number is explicitly part of the work reference.
        if key in seen:
            continue

        seen[key] = path
        files.append(path)

    return files


def print_title_mapping(author_dir: Path) -> None:
    files = iter_author_text_files(author_dir)
    print(f"\n## {author_dir.name} title mapping")
    for path in files:
        text = path.read_text(encoding="utf-8", errors="ignore")
        title = extract_title_from_text_or_filename(path, text)
        print(f"{path.name} -> {title}")
    print()


# Document preprocessing
def _clean_doc(doc):
    content = doc.page_content
    body_lines = []

    in_header = True
    for line in content.splitlines():
        if in_header and line.startswith("#"):
            match = re.match(r"^#([a-zA-Z0-9_]+)\s*(.*)$", line)
            if match:
                key, val = match.groups()
                # Store extracted header in doc metadata
                doc.metadata[key.lower()] = val.strip()
        else:
            # First non-# line signals the end of header directives
            if line.strip():
                in_header = False
            if not in_header:
                body_lines.append(line)

    # Normalize excessive whitespace and join clean body text
    cleaned_body = "\n".join(body_lines).strip()
    doc.page_content = re.sub(r"[ \t]+", " ", cleaned_body)

    return doc


def contains_multiple_works(raw_text: str) -> bool:
    return len(TITLE_LINE_RE.findall(raw_text)) > 1


def split_into_works(raw_text: str) -> list[tuple[str, str]]:
    """
    Splits a file's raw text into (title, work_text) pairs based on
    Gutenberg 'Title:' markers. Falls back to a single ('unknown', raw_text)
    if only one or zero titles are found.
    """
    matches = list(TITLE_LINE_RE.finditer(raw_text))
    if len(matches) <= 1:
        title = matches[0].group(1).strip() if matches else "unknown"
        return [(title, raw_text)]

    works = []
    for i, match in enumerate(matches):
        title = match.group(1).strip()
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw_text)
        works.append((title, raw_text[start:end]))
    return works

