import operator
from typing import Annotated, Any
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END

class State(TypedDict):
    question: str
    answer: str
    agent_outputs: list[dict[str, str]]
    targets: list[str]    # which authors should answer (overwritten each step)
    needs_rag: bool       # decided by the Laya router
    rag_probability: float
    history: list[dict[str, str]]
    state: Annotated[list, operator.add]  # append-only log

class ReturnNodeValue:
    """Placeholder node that just appends a message to the log."""

    def __init__(self, node_secret: str):
        self._value = node_secret

    def __call__(self, state: State) -> Any:
        print(f"Adding {self._value} to {state['state']}")
        return {"state": [self._value]}
    
