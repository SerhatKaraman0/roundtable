from langgraph.graph import StateGraph, START, END
from roundtable.graph.nodes import target_router, laya_router, route_to_retrievers, make_retriever
from roundtable.graph.state import State, ReturnNodeValue

AUTHORS = ["marx", "bakunin", "mill"]

builder = StateGraph(State)

builder.add_node("question", ReturnNodeValue("Received frontend question"))
builder.add_node("target_router", target_router)
builder.add_node("laya_router", laya_router)

for author in AUTHORS:
    builder.add_node(f"retrieve_{author}", make_retriever(author))
    builder.add_node(f"{author}_agent", ReturnNodeValue(f"{author.capitalize()} Agent"))

builder.add_node("answers", ReturnNodeValue("Answer(s) Node"))

# Linear part
builder.add_edge(START, "question")
builder.add_edge("question", "target_router")
builder.add_edge("target_router", "laya_router")

# Conditional fan-out to the selected authors
builder.add_conditional_edges(
    "laya_router",
    route_to_retrievers,
    [f"retrieve_{a}" for a in AUTHORS] + [END],
)

# Each branch: retrieve -> agent -> answers (same length, so answers runs once)
for author in AUTHORS:
    builder.add_edge(f"retrieve_{author}", f"{author}_agent")
    builder.add_edge(f"{author}_agent", "answers")

builder.add_edge("answers", END)

graph = builder.compile()
