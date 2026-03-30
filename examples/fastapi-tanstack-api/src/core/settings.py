from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    OPENROUTER_API_KEY: str
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENAI_LIKE_API_KEY: str
    OPENAI_LIKE_BASE_URL: str
    OPENAI_LIKE_MODEL: str
    TAVILY_API_KEY: str
    DATABASE_URL: str = "sqlite+aiosqlite:///./dev.db"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()  # type: ignore
