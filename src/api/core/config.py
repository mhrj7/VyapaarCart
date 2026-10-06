from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "VyapaarCart"
    DATABASE_URL: str = "postgresql+asyncpg://vyapaarcart:vyapaarcart_password@localhost:5432/vyapaarcart"
    SECRET_KEY: str = "supersecretkey" # Update in production
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    class Config:
        env_file = ".env"

settings = Settings()
