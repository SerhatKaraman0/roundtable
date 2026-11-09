# Roundtable

## Run the web chat with the Python router/RAG backend

From the repository root, install frontend dependencies once:

```bash
make setup-web
```

Then start both services together:

```bash
make dev
```

Or run `make backend` and `make frontend` in separate terminals.

The frontend posts chat turns to `http://localhost:8000/api/chat`. Set
`NEXT_PUBLIC_ROUNDTABLE_API_URL` in `src/web/.env.local` if the backend is
running at another URL. The API has a health endpoint at `/health`.

The API invokes the fine-tuned Laya router and runs the existing ensemble RAG
chain when retrieval is requested. It returns outputs in a stable
`{ author, text }` format for the character speech bubbles and forwards prior
turns to the graph. The philosopher answer nodes are still placeholders; when
they are implemented, they should populate `agent_outputs` in graph state.
Until then, non-RAG questions show a backend status in the chat input instead
of a fabricated philosopher reply. RAG answers use the existing local Ollama
model configured in `roundtable.rag.ensemble_rag`.
