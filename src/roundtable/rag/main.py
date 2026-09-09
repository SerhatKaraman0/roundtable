import os 
import re 
import hashlib
from pathlib import Path
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings
import chromadb

DATA_BASE_PATH  = Path(__file__).parent.parent / "data" / "knowledge_base"
BAKUNIN_PATH    = DATA_BASE_PATH / "bakunin"
MARX_PATH       = DATA_BASE_PATH / "marx"
MILL_PATH       = DATA_BASE_PATH / "mill"

COLLECTION_NAME = "roundtable"

chroma_client = chromadb.Client()
collection = chroma_client.get_or_create_collection(COLLECTION_NAME)

embedding_model = OllamaEmbeddings(model="bge-m3")

# Document preprocessing
def _clean_doc(doc):
    content = doc.page_content
    metadata_lines = []
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

# Document Loading 
def load_text_file():
    all_docs = []

    for path in [BAKUNIN_PATH, MARX_PATH, MILL_PATH]:
        author_name = path.name

        # Load files from directory
        loader = DirectoryLoader(
            path=str(path),
            glob="**/*.txt",
            loader_cls=TextLoader,
            use_multithreading=True,
            show_progress=True
        )
        docs = loader.load()

        # Inject the author name to the docs as metadata 
        for doc in docs:
            doc = _clean_doc(doc)

            doc.metadata["author"] = author_name
            doc_id = hashlib.sha256(
                            f"{doc.metadata['author']}:{doc.metadata['source']}".encode("utf-8")
                        ).hexdigest()
            
            doc.metadata["id"]     = doc_id
        all_docs.extend(docs)

    return all_docs

def push_to_chroma(docs):
    for doc in docs:
        collection.upsert(
            ids=doc.metadata["id"],
            metadatas=doc.metadata,
            documents=doc.page_content
        )


def similarity_saerch_with_scores(query: str, k: int):
    docs = load_text_file()

    vector_store = Chroma.from_documents(
        documents=docs,
        embedding=embedding_model,
        persist_directory="./roundtable_db"
    )

    results_with_scores = vector_store.similarity_search_with_score("your query", k=3)

    for i, (doc, score) in enumerate(results_with_scores):
        print(f"Result {i+1}: {doc.page_content[:150]} (Score: {score:.4f})")


def main():
    print("OUTPUT\n\n\n")

    docs = load_text_file()
    push_to_chroma(docs)

    query_text = "what is bakunin mad about?"

    similarity_saerch_with_scores(query_text, 3)

if __name__ == "__main__":
    main()