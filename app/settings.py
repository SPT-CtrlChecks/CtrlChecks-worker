import uuid
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str

    supabase_jwt_public_key: str | None = None
    supabase_jwt_secret: str | None = None

    ollama_base_url: str = "http://localhost:11434"
    ollama_timeout_seconds: float = 60.0
    public_base_url: str = ""
    gemini_api_key: str | None = None
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    chatbot_api_key: str | None = None
    webhook_secret: str | None = None

    worker_id: str = f"worker-{uuid.uuid4().hex[:8]}"
    log_level: str = "INFO"
    process_timeout_seconds: int = 1800
    max_retries: int = 3
    retry_base_seconds: float = 1.0
    retry_max_seconds: float = 20.0
    allowed_origins: str = "*"


settings = Settings()
