import os

# 1. Kill LangSmith tracing before any imports to avoid network timeouts
os.environ["LANGCHAIN_TRACING_V2"] = "false"
os.environ.pop("LANGSMITH_API_KEY", None)

# 2. Patch asyncio event loop lifecycle to prevent 'Event loop is closed' crashes
import nest_asyncio
nest_asyncio.apply()

import time
import asyncio
import itertools
import random
import sys
import types
from collections import defaultdict
from pathlib import Path
from typing import Any, List, Optional
from dotenv import load_dotenv
import warnings
warnings.filterwarnings("ignore")

from pydantic import PrivateAttr
from langchain_core.messages import BaseMessage
from langchain_core.outputs import ChatResult
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.documents import Document
from langchain_groq import ChatGroq
from langchain_ollama import OllamaEmbeddings
from langchain_chroma import Chroma

try:
    import langchain_community.chat_models.vertexai  # type: ignore
except ModuleNotFoundError:
    import langchain_google_vertexai as google_vertexai

    legacy_vertexai = types.ModuleType("langchain_community.chat_models.vertexai")
    legacy_vertexai.ChatVertexAI = google_vertexai.ChatVertexAI
    sys.modules["langchain_community.chat_models.vertexai"] = legacy_vertexai

from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas.testset.graph import KnowledgeGraph, Node, NodeType
from ragas.testset.transforms import default_transforms, apply_transforms
from ragas.testset.persona import Persona
from ragas.testset.synthesizers.multi_hop.specific import (
    MultiHopSpecificQuerySynthesizer,
)
from ragas.testset.synthesizers.multi_hop.abstract import (
    MultiHopAbstractQuerySynthesizer,
)
from ragas.testset import TestsetGenerator

load_dotenv()


# =====================================================================
# 1. Persistent Client-Rotating Groq Wrapper
# =====================================================================
class RotatingRateLimitedGroqChat(BaseChatModel):
    """
    Reuses persistent ChatGroq client instances across calls to prevent
    uncollected httpx connections and 'Event loop is closed' crashes.
    """
    model: str
    api_keys: List[str]
    temperature: float = 0.0
    delay_between_calls: float = 1.0
    max_retries: int = 5

    _client_cycle: Any = PrivateAttr()

    def __init__(self, **data):
        super().__init__(**data)
        if not self.api_keys:
            raise ValueError("At least one Groq API key must be provided.")

        # Create exactly one persistent client per key upfront
        clients = [
            ChatGroq(
                model=self.model,
                api_key=key,
                temperature=self.temperature,
                max_retries=1,
                request_timeout=25.0,
            )
            for key in self.api_keys
        ]
        self._client_cycle = itertools.cycle(clients)

    @property
    def _llm_type(self) -> str:
        return "rotating-groq-chat"

    def _get_client(self) -> ChatGroq:
        return next(self._client_cycle)

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> ChatResult:
        retries = 0
        backoff = 1.5

        while True:
            client = self._get_client()
            try:
                if self.delay_between_calls > 0:
                    time.sleep(self.delay_between_calls)
                return client._generate(messages, stop=stop, run_manager=run_manager, **kwargs)

            except Exception as e:
                err_msg = str(e).lower()
                is_retryable = any(x in err_msg for x in [
                    "429", "rate limit", "tpm", "rpd", "tokens per minute", "timeout", "timed out", "503"
                ])
                if is_retryable and retries < self.max_retries:
                    retries += 1
                    time.sleep(backoff)
                    backoff *= 1.5
                    continue
                raise e

    async def _agenerate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> ChatResult:
        retries = 0
        backoff = 1.5

        while True:
            client = self._get_client()
            try:
                if self.delay_between_calls > 0:
                    await asyncio.sleep(self.delay_between_calls)
                return await client._agenerate(messages, stop=stop, run_manager=run_manager, **kwargs)

            except Exception as e:
                err_msg = str(e).lower()
                is_retryable = any(x in err_msg for x in [
                    "429", "rate limit", "tpm", "rpd", "tokens per minute", "timeout", "timed out", "503"
                ])
                if is_retryable and retries < self.max_retries:
                    retries += 1
                    await asyncio.sleep(backoff)
                    backoff *= 1.5
                    continue
                raise e


# =====================================================================
# 2. Configuration & Initialization
# =====================================================================
from roundtable.rag.commons import DATA_ROOT, KNOWLEDGE_BASE_PATH, VECTOR_STORE_DIRS

groq_keys_env = os.environ.get("GROQ_CLOUD_API_KEYS", "")
GROQ_KEYS = [k.strip() for k in groq_keys_env.split(",") if k.strip()]

if not GROQ_KEYS:
    single_key = os.environ.get("GROQ_CLOUD_API_KEY")
    if single_key:
        GROQ_KEYS = [single_key]
    else:
        raise ValueError("Set GROQ_CLOUD_API_KEYS (comma-separated) or GROQ_CLOUD_API_KEY in .env")

# Qwen 3.8-27B provides higher daily budget (1,000 RPD) than Compound (250 RPD)
GROQ_MODEL = "qwen/qwen3.8-27b"

rotating_chat = RotatingRateLimitedGroqChat(
    model=GROQ_MODEL,
    api_keys=GROQ_KEYS,
    temperature=0.0,
    delay_between_calls=1.0,
)

generator_llm = LangchainLLMWrapper(rotating_chat)

embeddings = OllamaEmbeddings(model="bge-m3")
generator_embeddings = LangchainEmbeddingsWrapper(embeddings)


# =====================================================================
# 3. Stratified Document Sampling from ChromaDB
# =====================================================================
VECTOR_STORE_PATH = VECTOR_STORE_DIRS["ensemble"]

vector_store = Chroma(
    persist_directory=str(VECTOR_STORE_PATH),
    embedding_function=embeddings,
)

print("Fetching chunks and metadata from ChromaDB...")
page_size = 10000
offset = 0
all_documents = []
all_metadatas = []

while True:
    batch = vector_store._collection.get(
        limit=page_size,
        offset=offset,
        include=["documents", "metadatas"],
    )
    batch_documents = batch.get("documents", [])
    batch_metadatas = batch.get("metadatas", [])

    if not batch_documents:
        break

    all_documents.extend(batch_documents)
    all_metadatas.extend(batch_metadatas)

    if len(batch_documents) < page_size:
        break

    offset += len(batch_documents)

print(f"Total chunks retrieved from database: {len(all_documents)}")


def resolve_author(meta: dict) -> str:
    meta = meta or {}
    text_to_check = f"{meta.get('author', '')} {meta.get('source', '')}".lower()
    if "bakunin" in text_to_check:
        return "bakunin"
    if "marx" in text_to_check:
        return "marx"
    if "mill" in text_to_check:
        return "mill"
    return "other"


by_author = defaultdict(list)
for doc, meta in zip(all_documents, all_metadatas):
    author = resolve_author(meta)
    by_author[author].append((doc, meta))

for author, chunks in by_author.items():
    print(f"Found {len(chunks)} chunks for category: '{author}'")

# 100 chunks per author creates a balanced 300-node subgraph
CHUNKS_PER_AUTHOR = 100
random.seed(42)
sampled_data = []

for author in ["bakunin", "marx", "mill"]:
    pool = by_author.get(author, [])
    if pool:
        count = min(CHUNKS_PER_AUTHOR, len(pool))
        sampled_data.extend(random.sample(pool, count))
        print(f"Sampled {count} chunks from '{author}'")

if not sampled_data:
    print("Metadata didn't match author filters; sampling uniformly across all chunks.")
    combined = list(zip(all_documents, all_metadatas))
    sampled_data = random.sample(combined, min(300, len(combined)))

print(f"Building KnowledgeGraph with {len(sampled_data)} nodes...")

kg = KnowledgeGraph()
for text, meta in sampled_data:
    kg.nodes.append(
        Node(
            type=NodeType.DOCUMENT,
            properties={
                "page_content": text,
                "document_metadata": meta or {},
            },
        )
    )


# =====================================================================
# 4. Graph Transforms — using Ragas's default pipeline
# =====================================================================
# default_transforms() wires up the extractors + relationship builders
# (entities, keyphrases, overlap scores, summary embeddings, etc.) that
# the built-in multi-hop synthesizers actually expect. Hand-rolling a
# custom transform list (as before) silently breaks MultiHop synthesizers
# because they look for specific relationship types (e.g. "entities_overlap")
# that a plain CosineSimilarityBuilder never produces.
docs_for_transform = [
    Document(page_content=text, metadata=meta or {})
    for text, meta in sampled_data
]

print("Building default transform pipeline...")
transforms = default_transforms(
    documents=docs_for_transform,
    llm=generator_llm,
    embedding_model=generator_embeddings,
)

print("Applying KnowledgeGraph transforms on sampled nodes...")
apply_transforms(kg, transforms=transforms)

# Inspect edge count / types before generating
total_relationships = len(kg.relationships)
relationship_types = sorted(set(r.type for r in kg.relationships))
print(f"Total graph edges/relationships formed: {total_relationships}")
print(f"Relationship types present: {relationship_types}")

if total_relationships == 0:
    raise RuntimeError(
        "No relationships were created between nodes! "
        "Check that your sample size is large enough for multi-hop "
        "relationships to form (very small or highly dissimilar corpora "
        "can still fail to cluster)."
    )


# =====================================================================
# 5. Multi-Hop Synthesis Setup & Generation
# =====================================================================
personas = [
    Persona(
        name="Comparative Political Theorist",
        role_description=(
            "Focuses on ideological tensions between state socialism, anarchism, and classical liberalism. "
            "Formulates complex queries that trace how Marx's transitional dictatorship of the proletariat "
            "directly conflicts with Bakunin's critique of state power, while contrasting both against "
            "J.S. Mill's harm principle and defense of individual liberty."
        ),
    ),
    Persona(
        name="Dialectical & Historical Materialist Scholar",
        role_description=(
            "Analyzes systemic socio-economic structures, labor dynamics, and property relations. "
            "Poses multi-hop questions comparing Marx's theories of capital accumulation and alienation "
            "against Bakunin's federalist collectivism, examining whether their diagnoses of wage labor "
            "share common roots despite opposing revolutionary methods."
        ),
    ),
    Persona(
        name="Liberal Institutional & Rights Reformer",
        role_description=(
            "Examines democratic systems, institutional checks, and utilitarian governance through a Millian lens. "
            "Asks queries that pit Mill's utilitarian defense of free expression and constitutional reform against "
            "the revolutionary overthrows demanded by Bakunin and Marx, exploring where individual autonomy "
            "collapses under collective revolution."
        ),
    ),
    Persona(
        name="Revolutionary Strategy & Authority Critic",
        role_description=(
            "Investigates the legitimacy of political coercion and hierarchical authority. "
            "Targets queries requiring synthesis across all three authors regarding authority: "
            "Bakunin's rejection of all political authority, Marx's institutional capture of the state, "
            "and Mill's limits on state interference in personal self-determination."
        ),
    ),
]

query_distribution = [
    (MultiHopAbstractQuerySynthesizer(llm=generator_llm), 0.7),
    (MultiHopSpecificQuerySynthesizer(llm=generator_llm), 0.3),
]

generator = TestsetGenerator(
    llm=generator_llm,
    embedding_model=generator_embeddings,
    knowledge_graph=kg,
    persona_list=personas,
)

TESTSET_SAVE_PATH = DATA_ROOT / "eval" / "testsets" / "generated_testset.jsonl"
TESTSET_SAVE_PATH.parent.mkdir(parents=True, exist_ok=True)

print("Starting synthetic testset generation...")
testset = generator.generate(testset_size=10, query_distribution=query_distribution)

df = testset.to_pandas()
df.to_json(str(TESTSET_SAVE_PATH), orient="records", lines=True)

print(f"\nSaved {len(df)} test questions successfully to {TESTSET_SAVE_PATH}")
print(df.head())