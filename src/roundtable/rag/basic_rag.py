from pathlib import Path
import hashlib
from roundtable.rag.helpers import (
    _clean_doc,
    strip_gutenberg_boilerplate,
    contains_multiple_works,
    split_into_works,
    iter_author_text_files,
    print_title_mapping,
    extract_title_from_text_or_filename,
)
from roundtable.rag.commons import detect_authors, author_filtered_retrieve, BAKUNIN_PATH, MARX_PATH, MILL_PATH
from roundtable.rag.commons import VECTOR_STORE_DIRS
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableParallel, RunnablePassthrough, RunnableLambda
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

import warnings
warnings.filterwarnings("ignore")

CHROMA_PERSIST_DIR = VECTOR_STORE_DIRS["basic"]


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

    text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        encoding_name="cl100k_base",  # close enough proxy; bge-m3 isn't on tiktoken, this just gives consistent token-ish sizing
        chunk_size=400,       # tokens, not chars
        chunk_overlap=80,
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

llm = ChatOllama(model="qwen2.5:7b-instruct", temperature=0)

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", SYSTEM_PROMPT),
        ("human", "{input}"),
    ]
)

retriever_runnable = RunnableLambda(
    lambda x: author_filtered_retrieve(vector_store, x, k_total=8, known_titles=known_titles)
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


def run_basic_rag_chain(question: str) -> tuple[str, list[str]]:
    """Single source of truth for answering a question: reuses rag_chain
    directly instead of re-deriving retrieval/prompt logic, so this and
    rag_chain.invoke() can never drift out of sync."""
    result = rag_chain.invoke(question)
    docs = result["context"]
    ctxs = [doc.page_content for doc in docs]
    return result["answer"], ctxs