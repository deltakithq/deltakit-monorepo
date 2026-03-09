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
