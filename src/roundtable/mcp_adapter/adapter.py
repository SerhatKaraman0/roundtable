import asyncio
from langchain_mcp_adapters.client import MultiServerMCPClient


ALLOWED = {"search_docs_by_lang_chain"}


async def mcp_tools():
    client = MultiServerMCPClient({
        "docs-langchain": {
            "transport": "http",
            "url": "https://docs.langchain.com/mcp",
        }
    })
    tools = await client.get_tools()
    tools = [t for t in tools if t.name in ALLOWED]

    return tools

