from agents.extensions.models.litellm_model import LitellmModel

from src.core.settings import settings

llm_model = LitellmModel(
    base_url=settings.OPENROUTER_BASE_URL,
    api_key=settings.OPENROUTER_API_KEY,
    model="openrouter/xiaomi/mimo-v2-flash",
)
