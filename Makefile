.PHONY: help setup-web backend frontend dev

help:
	@printf '%s\n' \
	  'make setup-web  Install the frontend npm dependencies' \
	  'make backend    Run the Python API on http://localhost:8000' \
	  'make frontend   Run the Next.js app on http://localhost:3000' \
	  'make dev        Run backend and frontend together'

setup-web:
	cd src/web && npm install

backend:
	uv run uvicorn roundtable.api:app --reload --port 8000

frontend:
	cd src/web && npm run dev

dev:
	$(MAKE) -j2 backend frontend
