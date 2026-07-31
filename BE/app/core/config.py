"""Application configuration."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "AlgoTradeDynamics API"
    environment: str = "development"
    log_level: str = "INFO"

    database_url: str = "sqlite:///./algotrade.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    bot_worker_enabled: bool = True
    exchange_emulator_url: str = "http://exchange-emulator:8001"
    exchange_emulator_default_api_key: str = "emulator-default-key"

    # --- Auth / JWT ---
    jwt_secret_key: str = "dev-secret-change-me-0123456789abcdef0123456789abcdef"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
