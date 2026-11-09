from pathlib import Path
from threading import Lock

from langgraph.graph import END
from roundtable.graph.state import State

AUTHORS = ["marx", "bakunin", "mill"]

def target_router(state: State) -> dict:
    """
    Selects the question target, question can be targeted to one of 
    the philosophers or every philosopher or a set of philosophers etc.
    """
    requested = state.get("targets") or AUTHORS
    targets = [author for author in requested if author in AUTHORS]
    if not targets:
        targets = list(AUTHORS)
    print(f"Targets selected: {targets}")
    return {"targets": targets, "state": ["Select the target(s) of the question"]}

def laya_router(state: State) -> dict:
    """
    Declares whether the question needs to be sent to RAG chain
    or it can be answered by the fine-tuned LLM by itself.
    """
    import laya
    import torch

    checkpoint = Path(__file__).resolve().parents[1] / "data/finetune/fientuned_models/laya_router"
    if not checkpoint.is_dir():
        raise FileNotFoundError(f"Fine-tuned Laya router checkpoint not found: {checkpoint}")

    agent = _load_laya_router(laya, checkpoint, "cuda" if torch.cuda.is_available() else "cpu")
    result = agent.predict(state["question"], ROUTER_QUESTIONS)
    probability = float(result["answers"]["needs_rag"]["noul"])
    needs_rag = probability >= 0.5
    print(f"Needs RAG: {needs_rag} (probability={probability:.3f})")
    return {
        "needs_rag": needs_rag,
        "rag_probability": probability,
        "state": ["Laya decided whether the question needs RAG"],
    }


_laya_router = None
_laya_router_device = None
_laya_router_lock = Lock()


ROUTER_QUESTIONS = {
    "needs_rag": {
        "type": "noul",
        "instructions": (
            "Does answering this philosopher question reliably require retrieving "
            "specific evidence from the philosopher's source documents? Answer yes "
            "for exact biographical, historical, quotation, or source-specific facts. "
            "Answer no for established philosophical concepts, general comparisons, "
            "principled reasoning, and hypothetical applications."
        ),
        "criteria": {
            "false": "No: answer from the model's learned knowledge or reasoning.",
            "true": "Yes: retrieve supporting evidence from the RAG system.",
        },
    }
}


def _load_laya_router(laya_module, checkpoint: Path, device: str):
    global _laya_router, _laya_router_device
    with _laya_router_lock:
        if _laya_router is None or _laya_router_device != device:
            _laya_router = laya_module.load(str(checkpoint), device=device)
            _laya_router_device = device
    return _laya_router

def route_to_retrievers(state: State) -> list[str]:
    """Fan out to one retrieve node per selected author."""
    targets = [a for a in state["targets"] if a in AUTHORS]
    return [f"retrieve_{a}" for a in targets] or [END]

def make_retriever(author: str):
    def retrieve(state: State) -> dict:
        if state["needs_rag"]:
            msg = f"Made RAG call with author={author} metadata"
        else:
            msg = f"Skipped RAG for {author}"
        print(msg)
        return {"state": [msg]}
    return retrieve
