import json
from typing import Literal

from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from agno.models.openrouter import OpenRouter
from agno.tools import tool
from tavily import TavilyClient

from src.core.settings import settings

tavily_client = TavilyClient(api_key=settings.TAVILY_API_KEY)


@tool
def search_web(query: str, label: str | None = None) -> str:
    """
    Search the web for information using Tavily API.

    query: The search query to use.
    label: The label to use to tell what you are currently doing with this tool
    """
    results = tavily_client.search(query, max_results=3)
    return json.dumps(results)


@tool
def crawl_website(
    url: str,
    instructions: str = "",
    max_depth: int = 1,
    max_breadth: int = 20,
    limit: int = 50,
    label: str | None = None,
) -> str:
    """
    Crawl a website to discover and extract content from multiple pages.
    Uses Tavily's graph-based crawler to explore pages in parallel.

    url: The root URL to begin the crawl (e.g., "https://docs.example.com").
    instructions: Natural language instructions to guide the crawler
        (e.g., "Find all pages about pricing").
    max_depth: How far from the base URL to explore (1-5, default=1).
    max_breadth: Number of links to follow per page (1-500, default=20).
    limit: Total number of pages to extract before stopping (default=50).
    label: The label to use to tell what you are currently doing with this tool.
    """
    results = tavily_client.crawl(
        url=url,
        instructions=instructions or None,  # type: ignore[arg-type]
        max_depth=max_depth,
        max_breadth=max_breadth,
        limit=limit,
    )
    return json.dumps(results)


@tool
def extract_webpage(
    urls: str | list[str],
    extract_depth: Literal["basic", "advanced"] = "basic",
    include_images: bool = False,
    label: str | None = None,
) -> str:
    """
    Extract content from one or more specific URLs.
    Use this for scraping content from known pages.

    urls: A single URL string or list of URLs to extract content from.
    extract_depth: Depth of extraction - "basic" (default) or "advanced"
        (includes tables/embedded content).
    include_images: Whether to include image URLs in the results (default=False).
    label: The label to use to tell what you are currently doing with this tool.
    """
    results = tavily_client.extract(
        urls=urls,
        extract_depth=extract_depth,
        include_images=include_images,
    )
    return json.dumps(results)


SYSTEM_PROMPT = """
You are a helpful assistant.

- Be verbose.
- Tell what user what you will do before calling a tool.
"""


# Initialize storage
storage = SqliteDb(
    session_table="agno_agent_sessions",
    db_file="./dev.db",
)


def get_agent(session_id: str = "default") -> Agent:
    """Create and return an Agno agent configured for the given session."""
    return Agent(
        model=OpenRouter(
            id="kimi-k2.5",
            api_key=settings.OPENROUTER_API_KEY,
        ),
        tools=[search_web, crawl_website, extract_webpage],
        instructions=SYSTEM_PROMPT,
        db=storage,
        session_id=session_id,
        add_history_to_context=True,
        markdown=True,
    )
