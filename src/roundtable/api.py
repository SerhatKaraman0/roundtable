"""HTTP bridge between the web chat and the Roundtable graph/RAG pipeline."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from roundtable.graph.workflow import graph

AUTHORS = {"marx", "bakunin", "mill"}


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    author: str = "user"
    content: str = Field(min_length=1, max_length=20_000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=20_000)
    targets: list[str] = Field(default_factory=list)
    history: list[ChatTurn] = Field(default_factory=list, max_length=100)


class AgentOutput(BaseModel):
    author: str
    text: str


class ChatResponse(BaseModel):
    status: Literal["answered", "agents_not_configured"]
    outputs: list[AgentOutput]
    targets: list[str]
    needs_rag: bool
    rag_probability: float
    sources: list[str] = Field(default_factory=list)
    detail: str | None = None


app = FastAPI(title="Roundtable API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def _rag_runner():
    # Import lazily so a question routed to the model-only/agent path does not
    # initialize Chroma or require the Ollama RAG model at API startup.
    from roundtable.rag.ensemble_rag import run_ensemble_rag_chain

    return run_ensemble_rag_chain


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="message must not be blank")

    targets = [author for author in request.targets if author in AUTHORS]
    history = [turn.model_dump() for turn in request.history]
    try:
        result = graph.invoke(
            {
                "question": message,
                "answer": "",
                "agent_outputs": [],
                "targets": targets,
                "needs_rag": False,
                "rag_probability": 0.0,
                "history": history,
                "state": [],
            }
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Router failed: {exc}") from exc

    selected_targets = result.get("targets", targets)
    outputs = _normalize_graph_outputs(
        result.get("agent_outputs", []), selected_targets, result.get("answer", "")
    )
    sources: list[str] = []

    if result.get("needs_rag"):
        try:
            answer, sources = _rag_runner()(message)
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"RAG request failed: {exc}") from exc
        if answer and answer.strip():
            author = selected_targets[0] if len(selected_targets) == 1 else "roundtable"
            outputs = [AgentOutput(author=author, text=answer.strip())]

    # The answer graph nodes are still placeholders by design. Returning an
    # explicit empty result lets the UI show the pending state without a stub
    # reply; implemented agent nodes can populate `agent_outputs` later.
    status: Literal["answered", "agents_not_configured"] = (
        "answered" if outputs else "agents_not_configured"
    )
    return ChatResponse(
        status=status,
        outputs=outputs,
        targets=selected_targets,
        needs_rag=bool(result.get("needs_rag", False)),
        rag_probability=float(result.get("rag_probability", 0.0)),
        sources=sources,
        detail=(
            None
            if outputs
            else "The message reached the backend, but no answer agent is configured for this route yet."
        ),
    )


def _normalize_graph_outputs(
    raw_outputs: object, targets: list[str], answer: object = ""
) -> list[AgentOutput]:
    if not isinstance(raw_outputs, list):
        return []
    outputs: list[AgentOutput] = []
    for raw in raw_outputs:
        if not isinstance(raw, dict):
            continue
        author = str(raw.get("author", "roundtable"))
        text = str(raw.get("text", "")).strip()
        if text:
            outputs.append(AgentOutput(author=author, text=text))
    answer_text = str(answer).strip()
    if not outputs and answer_text:
        outputs.append(
            AgentOutput(
                author=targets[0] if len(targets) == 1 else "roundtable",
                text=answer_text,
            )
        )
    return outputs
