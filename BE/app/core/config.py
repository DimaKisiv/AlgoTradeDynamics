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
    # Access tokens are deliberately short-lived; a refresh-token cookie renews them.
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    refresh_cookie_name: str = "atd_refresh_token"
    refresh_cookie_secure: bool = False
    refresh_cookie_samesite: str = "lax"

    # --- API rate limiting (single-process MVP) ---
    rate_limit_enabled: bool = True
    rate_limit_trust_proxy_headers: bool = False

    rate_limit_login_requests: int = 5
    rate_limit_login_window_seconds: int = 60
    rate_limit_register_requests: int = 5
    rate_limit_register_window_seconds: int = 60
    rate_limit_refresh_requests: int = 30
    rate_limit_refresh_window_seconds: int = 60

    rate_limit_api_requests: int = 300
    rate_limit_api_window_seconds: int = 60
    rate_limit_api_write_requests: int = 120
    rate_limit_api_write_window_seconds: int = 60

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
