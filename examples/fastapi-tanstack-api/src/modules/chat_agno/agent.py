from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from agno.models.openai.like import OpenAILike

from src.core.settings import settings

SYSTEM_PROMPT = """
You are a helpful assistant.

- Be verbose.
"""


# Initialize storage
storage = SqliteDb(
    session_table="agno_agent_sessions",
    db_file="./dev.db",
)


def get_agent(session_id: str = "default") -> Agent:
    """Create and return an Agno agent configured for the given session."""
    return Agent(
        model=OpenAILike(
            id=settings.OPENAI_LIKE_MODEL,
            api_key=settings.OPENAI_LIKE_API_KEY,
            base_url=settings.OPENAI_LIKE_BASE_URL,
        ),
        instructions=SYSTEM_PROMPT,
        db=storage,
        session_id=session_id,
        add_history_to_context=True,
        markdown=True,
    )
