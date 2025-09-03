"""
Configuration management for Clinic-AI application.

This module provides centralized configuration using Pydantic Settings
for environment-based configuration management.
"""

from typing import List, Optional

from pydantic import Field, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    """Database configuration settings."""

    model_config = SettingsConfigDict(env_prefix="MONGO_")

    uri: str = Field(
        default="mongodb://localhost:27017", description="MongoDB connection URI"
    )
    db_name: str = Field(default="clinicai", description="MongoDB database name")
    collection: str = Field(default="clinicAi", description="MongoDB collection name")

    @validator("uri")
    def validate_mongo_uri(cls, v: str) -> str:
        """Validate MongoDB URI format."""
        if not v.startswith(("mongodb://", "mongodb+srv://")):
            raise ValueError(
                "MongoDB URI must start with 'mongodb://' or 'mongodb+srv://'"
            )
        return v


class OpenAISettings(BaseSettings):
    """OpenAI API configuration settings."""

    model_config = SettingsConfigDict(env_prefix="OPENAI_")

    api_key: str = Field(default="", description="OpenAI API key")
    model: str = Field(default="gpt-4", description="Default OpenAI model")
    max_tokens: int = Field(default=4000, description="Maximum tokens for responses")
    temperature: float = Field(
        default=0.7, description="Temperature for model responses"
    )

    @validator("api_key")
    def validate_api_key(cls, v: str) -> str:
        """Validate OpenAI API key format."""
        if v and not v.startswith("sk-"):
            raise ValueError("OpenAI API key must start with 'sk-'")
        return v


class SecuritySettings(BaseSettings):
    """Security configuration settings."""

    model_config = SettingsConfigDict(env_prefix="SECURITY_")

    secret_key: str = Field(
        default="your-secret-key-change-in-production", description="JWT secret key"
    )
    algorithm: str = Field(default="HS256", description="JWT algorithm")
    access_token_expire_minutes: int = Field(
        default=30, description="Access token expiration time"
    )

    @validator("secret_key")
    def validate_secret_key(cls, v: str) -> str:
        """Validate secret key strength."""
        if len(v) < 32:
            raise ValueError("Secret key must be at least 32 characters long")
        return v


class CORSSettings(BaseSettings):
    """CORS configuration settings."""

    model_config = SettingsConfigDict(env_prefix="CORS_")

    allowed_origins: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8080"],
        description="Allowed CORS origins",
    )
    allowed_methods: List[str] = Field(
        default=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        description="Allowed HTTP methods",
    )
    allowed_headers: List[str] = Field(
        default=["*"], description="Allowed HTTP headers"
    )
    allow_credentials: bool = Field(
        default=True, description="Allow credentials in CORS"
    )

    @validator("allowed_origins", pre=True)
    def parse_allowed_origins(cls, v):
        """Parse allowed origins from string or list."""
        if isinstance(v, str):
            # Handle JSON-like string format
            if v.startswith("[") and v.endswith("]"):
                import json

                try:
                    return json.loads(v)
                except json.JSONDecodeError:
                    return [v.strip()]
            return [v.strip()]
        return v


class LoggingSettings(BaseSettings):
    """Logging configuration settings."""

    model_config = SettingsConfigDict(env_prefix="LOG_")

    level: str = Field(default="INFO", description="Logging level")
    format: str = Field(default="json", description="Log format (json or text)")
    file_path: Optional[str] = Field(default=None, description="Log file path")

    @validator("level")
    def validate_log_level(cls, v: str) -> str:
        """Validate logging level."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Log level must be one of: {valid_levels}")
        return v.upper()


class Settings(BaseSettings):
    """Main application settings."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    # Application settings
    app_name: str = Field(default="Clinic-AI", description="Application name")
    app_version: str = Field(default="0.1.0", description="Application version")
    app_env: str = Field(default="development", description="Application environment")
    debug: bool = Field(default=False, description="Debug mode")
    port: int = Field(default=8000, description="Application port")
    host: str = Field(default="0.0.0.0", description="Application host")

    # Sub-settings
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    openai: OpenAISettings = Field(default_factory=OpenAISettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)
    cors: CORSSettings = Field(default_factory=CORSSettings)
    logging: LoggingSettings = Field(default_factory=LoggingSettings)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Override sub-settings with environment variables
        self.database = DatabaseSettings()
        self.openai = OpenAISettings()
        self.security = SecuritySettings()
        self.cors = CORSSettings()
        self.logging = LoggingSettings()

    @validator("app_env")
    def validate_app_env(cls, v: str) -> str:
        """Validate application environment."""
        valid_envs = ["development", "staging", "production", "testing"]
        if v.lower() not in valid_envs:
            raise ValueError(f"App environment must be one of: {valid_envs}")
        return v.lower()

    @validator("port")
    def validate_port(cls, v: int) -> int:
        """Validate port number."""
        if not 1 <= v <= 65535:
            raise ValueError("Port must be between 1 and 65535")
        return v

    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.app_env == "development"

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.app_env == "production"

    @property
    def is_testing(self) -> bool:
        """Check if running in testing mode."""
        return self.app_env == "testing"


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get application settings instance."""
    return settings
