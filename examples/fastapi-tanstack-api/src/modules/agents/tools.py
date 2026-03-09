from agents import function_tool


@function_tool
def search_web(query: str) -> str:
    """Search the web for information."""
    return f"Search results for: {query}"
