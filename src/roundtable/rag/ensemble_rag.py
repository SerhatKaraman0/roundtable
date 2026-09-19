from pathlib import Path
import hashlib

from roundtable.rag.helpers import (
    _clean_doc,
    strip_gutenberg_boilerplate,
    contains_multiple_works,
    split_into_works,
    TITLE_LINE_RE,
    iter_author_text_files,
    print_title_mapping,
    extract_title_from_text_or_filename,
)
from roundtable.rag.commons import detect_authors, detect_titles, BAKUNIN_PATH, MARX_PATH, MILL_PATH, KNOWN_AUTHORS
from roundtable.rag.commons import VECTOR_STORE_DIRS
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_community.retrievers import BM25Retriever
from langchain_classic.retrievers import EnsembleRetriever
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableParallel, RunnablePassthrough, RunnableLambda
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

import warnings
warnings.filterwarnings("ignore")

CHROMA_PERSIST_DIR = VECTOR_STORE_DIRS["ensemble"]

SYSTEM_PROMPT = (
    "You are answering questions about political philosophy using only the "
    "context passages provided below. Each passage is labeled with its author.\n\n"
    "Rules:\n"
    "- Only make claims that are explicitly supported by the labeled context.\n"
    "- When describing an author's view, attribute it ONLY to that labeled author "
    "— never attribute one author's claim to a different author.\n"
    "- If the context includes one author's critique or description of another "
    "author's view, be careful to state whose view it actually is.\n"
    "- If the context does not contain enough information to answer, say so "
    "explicitly rather than guessing.\n"
    "- Do not use outside knowledge beyond what's in the context.\n\n"
    "Context:\n{context}"
)


def load_and_chunk_documents() -> list[Document]:
    """Loads all author source files, cleans/strips boilerplate, splits
    multi-work files apart, and chunks everything for embedding."""
    all_docs = []

    for author_dir in [BAKUNIN_PATH, MARX_PATH, MILL_PATH]:
        author_name = author_dir.name
        # print_title_mapping(author_dir)

        for file_path in iter_author_text_files(author_dir):
            loader = TextLoader(str(file_path), encoding="utf-8")
            doc = loader.load()[0]
            raw_text = doc.page_content

            if contains_multiple_works(raw_text):
                for title, work_text in split_into_works(raw_text):
                    cleaned_text = strip_gutenberg_boilerplate(work_text)
                    all_docs.append(Document(
                        page_content=cleaned_text,
                        metadata={**doc.metadata, "author": author_name, "title": title},
                    ))
            else:
                doc = _clean_doc(doc)
                doc.page_content = strip_gutenberg_boilerplate(doc.page_content)
                doc.metadata["author"] = author_name
                doc.metadata["title"] = extract_title_from_text_or_filename(file_path, raw_text)
                all_docs.append(doc)

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=["\n\n", "\n", ". ", "? ", "! ", "; ", " ", ""],
    )
    chunks = text_splitter.split_documents(all_docs)

    for i, chunk in enumerate(chunks):
        chunk_id = hashlib.sha256(
            f"{chunk.metadata['author']}:{chunk.metadata['source']}:{i}:{chunk.page_content[:50]}".encode("utf-8")
        ).hexdigest()
        chunk.metadata["id"] = chunk_id

    return chunks


def build_vector_store(
    persist_dir: Path = CHROMA_PERSIST_DIR,
    force_rebuild: bool = False,
) -> tuple[Chroma, list[Document]]:
    """
    Loads or builds the Chroma vector store. Pass force_rebuild=True to
    ignore any existing persisted store and re-embed from current chunking
    logic — use this whenever chunking/cleaning code has changed, instead
    of relying on the directory-exists check alone.
    """
    embeddings = OllamaEmbeddings(model="bge-m3")

    if force_rebuild and persist_dir.exists():
        import shutil
        shutil.rmtree(persist_dir)

    chunks = load_and_chunk_documents()

    if persist_dir.exists():
        store = Chroma(persist_directory=str(persist_dir), embedding_function=embeddings)
    else:
        store = Chroma.from_documents(
            documents=chunks,
            embedding=embeddings,
            persist_directory=str(persist_dir),
        )

    return store, chunks


def build_author_ensembles(
    vector_store: Chroma, chunks: list[Document]
) -> tuple[dict[str, EnsembleRetriever], EnsembleRetriever]:
    """
    EnsembleRetriever/BM25Retriever don't support metadata filters directly,
    so we build one vector+BM25 ensemble per author, using chunks
    pre-filtered by author for BM25, and a Chroma metadata filter for the
    vector side. Also returns a fallback ensemble over the full pooled
    corpus for questions where no author is detected.
    """
    author_ensembles: dict[str, EnsembleRetriever] = {}

    for author in KNOWN_AUTHORS:
        author_chunks = [c for c in chunks if c.metadata.get("author") == author]
        if not author_chunks:
            continue

        author_vector_retriever = vector_store.as_retriever(
            search_kwargs={"k": 4, "filter": {"author": author}}
        )
        author_bm25_retriever = BM25Retriever.from_documents(documents=author_chunks, k=4)

        author_ensembles[author] = EnsembleRetriever(
            retrievers=[author_vector_retriever, author_bm25_retriever],
            weights=[0.7, 0.3],
        )

    fallback_vector_retriever = vector_store.as_retriever(search_kwargs={"k": 6})
    fallback_bm25_retriever = BM25Retriever.from_documents(documents=chunks, k=6)
    fallback_ensemble = EnsembleRetriever(
        retrievers=[fallback_vector_retriever, fallback_bm25_retriever],
        weights=[0.7, 0.3],
    )

    return author_ensembles, fallback_ensemble

def author_filtered_ensemble_retrieve(
    question: str,
    vector_store: Chroma,
    chunks: list[Document],
    author_ensembles: dict[str, EnsembleRetriever],
    fallback_ensemble: EnsembleRetriever,
    known_titles: list[str] | None = None,
    k_total: int = 8,
) -> list[Document]:
    authors = detect_authors(question)
    titles = detect_titles(question, known_titles or [])

    if not authors:
        return fallback_ensemble.invoke(question)

    k_per_author = max(1, k_total // len(authors))
    docs, seen_ids = [], set()

    for author in authors:
        author_titles = titles  # titles detected anywhere in the question

        if author_titles:
            # Vector side: filter directly at query time, no shared-object mutation
            vector_hits = []
            for title in author_titles:
                vector_hits.extend(vector_store.similarity_search(
                    question, k=k_per_author,
                    filter={"$and": [{"author": author}, {"title": title}]},
                ))

            # BM25 side: build a fresh, title-scoped retriever for this call
            title_scoped_chunks = [
                c for c in chunks
                if c.metadata.get("author") == author and c.metadata.get("title") in author_titles
            ]
            bm25_hits = []
            if title_scoped_chunks:
                bm25_hits = BM25Retriever.from_documents(
                    documents=title_scoped_chunks, k=k_per_author
                ).invoke(question)

            combined = vector_hits + bm25_hits
        else:
            combined = []

        if not combined:
            # fall back to the author-only ensemble (safe: no filter mutation here)
            combined = author_ensembles.get(author).invoke(question) if author_ensembles.get(author) else []

        for doc in combined:
            doc_id = doc.metadata.get("id")
            if doc_id not in seen_ids:
                docs.append(doc)
                seen_ids.add(doc_id)

    if not docs:
        return fallback_ensemble.invoke(question)

    return docs

def format_context(docs: list[Document]) -> str:
    """Groups and labels chunks by author so the LLM can't conflate sources."""
    formatted = []
    for doc in docs:
        author = doc.metadata.get("author", "unknown").capitalize()
        title = doc.metadata.get("title", "")
        label = f"{author} — {title}" if title else author
        formatted.append(f"[{label}]\n{doc.page_content}")
    return "\n\n---\n\n".join(formatted)


# --- Module-level default instances (import-time build, same as before) ---
# NOTE: this still builds/loads at import time for convenience. If you need
# a guaranteed fresh rebuild within the same process (e.g. from an eval
# script), call build_vector_store(force_rebuild=True) explicitly instead
# of relying on this default.
vector_store, chunks = build_vector_store()
known_titles = sorted({chunk.metadata.get("title", "") for chunk in chunks if chunk.metadata.get("title")})
author_ensembles, fallback_ensemble = build_author_ensembles(vector_store, chunks)

llm = ChatOllama(model="qwen2.5:7b-instruct", temperature=0)

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", SYSTEM_PROMPT),
        ("human", "{input}"),
    ]
)

retriever_runnable = RunnableLambda(
    lambda x: author_filtered_ensemble_retrieve(
        x, vector_store, chunks, author_ensembles, fallback_ensemble, known_titles=known_titles
    )
)

rag_chain = RunnableParallel(
    {"context": retriever_runnable, "input": RunnablePassthrough()}
).assign(
    answer=(
        RunnablePassthrough.assign(context=lambda x: format_context(x["context"]))
        | prompt
        | llm
        | StrOutputParser()
    )
)


# # --- Query ---
# query = "What is the way over governing according to Bakunin and what do marx think about this?"
# result = rag_chain.invoke(query)
#
# print("Answer:", result["answer"])
# print("\nSource Documents:")
# for doc in result["context"]:
#     print(f"  [{doc.metadata.get('title', 'unknown')}] {doc.page_content[:100]}...")


def run_ensemble_rag_chain(question: str) -> tuple[str, list[str]]:
    """Single source of truth for answering a question: reuses rag_chain
    directly instead of re-deriving retrieval/prompt logic, so this and
    rag_chain.invoke() can never drift out of sync."""
    result = rag_chain.invoke(question)
    docs = result["context"]
    ctxs = [doc.page_content for doc in docs]
    return result["answer"], ctxs