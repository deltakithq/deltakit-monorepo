import json

from agents import function_tool
from tavily import TavilyClient

from src.core.settings import settings

tavily_client = TavilyClient(api_key=settings.TAVILY_API_KEY)


@function_tool
def search_web(query: str, label: str | None = None):
    """
    Search the web for information using Tavily API.

    query: The search query to use.
    label: The label to use to tell what you are currently doing with this tool
    """
    results = tavily_client.search(query, max_results=3)
    return json.dumps(results)


@function_tool
def crawl_website(
    url: str,
    instructions: str | None = None,
    max_depth: int = 1,
    max_breadth: int = 20,
    limit: int = 50,
    label: str | None = None,
):
    """
    Crawl a website to discover and extract content from multiple pages.
    Uses Tavily's graph-based crawler to explore pages in parallel.

    url: The root URL to begin the crawl (e.g., "https://docs.example.com").
    instructions: Natural language instructions to guide the crawler (e.g., "Find all pages about pricing").
    max_depth: How far from the base URL to explore (1-5, default=1).
    max_breadth: Number of links to follow per page (1-500, default=20).
    limit: Total number of pages to extract before stopping (default=50).
    label: The label to use to tell what you are currently doing with this tool.
    """
    results = tavily_client.crawl(
        url=url,
        instructions=instructions,
        max_depth=max_depth,
        max_breadth=max_breadth,
        limit=limit,
    )
    return json.dumps(results)


@function_tool
def extract_webpage(
    urls: str | list[str],
    extract_depth: str = "basic",
    include_images: bool = False,
    label: str | None = None,
):
    """
    Extract content from one or more specific URLs.
    Use this for scraping content from known pages.

    urls: A single URL string or list of URLs to extract content from.
    extract_depth: Depth of extraction - "basic" (default) or "advanced" (includes tables/embedded content).
    include_images: Whether to include image URLs in the results (default=False).
    label: The label to use to tell what you are currently doing with this tool.
    """
    results = tavily_client.extract(
        urls=urls,
        extract_depth=extract_depth,
        include_images=include_images,
    )
    return json.dumps(results)
