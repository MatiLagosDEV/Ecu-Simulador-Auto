from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuración desde .env"""
    
    # Base de datos
    DATABASE_URL: str = "sqlite:///./obd2_licencias.db"
    
    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000  # FastAPI en 8000, server.py OBD en 5000
    DEBUG: bool = True  # Temporal: generar licencia para testing
    
    # Licencias
    LICENSE_KEY_LENGTH: int = 32
    LICENSE_VALIDITY_DAYS: Optional[int] = None  # None = sin expiración
    
    # Pagos (completar después)
    STRIPE_SECRET_KEY: str = ""
    FLOW_API_SECRET: str = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
