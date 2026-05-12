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

    default_dataset: str = "data/btc_usdt_2024.csv"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
