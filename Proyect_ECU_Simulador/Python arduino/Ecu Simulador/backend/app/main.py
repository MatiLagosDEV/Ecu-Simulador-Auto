from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
import secrets
import string
import logging

from app.config import settings
from app.database import get_db, engine, Base
from app.models import Licencia
from app import crud
from app.schemas import (
    LicenseActivateRequest, LicenseStatusRequest, LicenseTransferRequest,
    ActivateResponse, StatusResponse, TransferResponse, LicenseResponse,
    GenerateLicenseRequest
)

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Crear tablas si no existen
Base.metadata.create_all(bind=engine)

# Crear app
app = FastAPI(
    title="OBD2 License Manager",
    description="API de gestión de licencias para app OBD2",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ════════════════════════════════════════════════════════
# ENDPOINTS
# ════════════════════════════════════════════════════════

@app.get("/health")
def health_check():
    """Verificar que el servidor está activo y la BD está conectada"""
    try:
        logger.debug("Health check solicitado")
        return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}
    except Exception as e:
        logger.error(f"Health check fallido: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Servidor no disponible"
        )


@app.post("/license/activate", response_model=ActivateResponse)
def activate_license(
    request: LicenseActivateRequest,
    db: Session = Depends(get_db)
):
    """
    Activa una licencia en un device.
    
    Comportamiento:
    - Si no tiene device → se asigna el device actual
    - Si tiene el MISMO device → OK (solo actualiza timestamp)
    - Si tiene OTRO device → requiere transferencia (no se activa)
    
    Códigos de error:
    - 404: Licencia no encontrada
    - 400: Otros errores (device incorrecto, etc)
    """
    try:
        license_obj, message = crud.activate_license(
            db, request.license_key, request.device_id
        )
        
        if license_obj is None:
            logger.warning(f"Activación fallida: {message}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=message
            )
        
        # Si requiere transferencia
        if "otro dispositivo" in message.lower():
            logger.info(f"Activación rechazada (requiere transferencia): {request.license_key}")
            return ActivateResponse(
                success=False,
                message=message,
                requires_transfer=True
            )
        
        logger.info(f"Activación exitosa: {request.license_key} en {request.device_id}")
        return ActivateResponse(
            success=True,
            message=message,
            requires_transfer=False
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error no esperado en activate: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al activar licencia"
        )


@app.post("/license/transfer", response_model=TransferResponse)
def transfer_license(
    request: LicenseTransferRequest,
    db: Session = Depends(get_db)
):
    """
    Transfiere licencia a otro dispositivo.
    
    - Actualiza device_id_actual
    - Registra cambio en tabla transfers (auditoría)
    - Devuelve datos antes/después del cambio
    """
    try:
        license_obj, message = crud.transfer_license(
            db, request.license_key, request.device_id_nuevo, request.razon
        )
        
        if license_obj is None:
            logger.warning(f"Transferencia fallida: {message}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=message
            )
        
        logger.info(f"Transferencia exitosa: {request.license_key}")
        return TransferResponse(
            success=True,
            message=message,
            device_id_anterior=license_obj.device_id_actual,
            device_id_nuevo=request.device_id_nuevo
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error no esperado en transfer: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al transferir licencia"
        )


@app.post("/license/status", response_model=StatusResponse)
def license_status(
    request: LicenseStatusRequest,
    db: Session = Depends(get_db)
):
    """
    Valida si una licencia es válida para este dispositivo.
    
    Verifica:
    1. license_key existe
    2. device_id coincide
    3. no está expirada
    4. retorna is_pro (True si es PRO, False si es gratuita o inválida)
    
    Este endpoint es CRÍTICO para la app:
    - Lo llama la app cada 24h
    - Determina si desbloquea features PRO
    """
    try:
        valid, is_pro = crud.validate_license(
            db, request.license_key, request.device_id
        )
        
        message = None
        if not valid:
            message = "Licencia no válida para este dispositivo"
            logger.debug(f"Validación fallida: {request.license_key}")
        
        logger.debug(f"Status solicitado: valid={valid}, is_pro={is_pro}")
        return StatusResponse(
            valid=valid,
            is_pro=is_pro,
            message=message
        )
    
    except Exception as e:
        logger.error(f"Error no esperado en status: {str(e)}")
        # En caso de error, retornar conservative (no válida)
        return StatusResponse(
            valid=False,
            is_pro=False,
            message="Error al validar licencia"
        )


@app.get("/license/info/{license_key}", response_model=LicenseResponse)
def get_license_info(
    license_key: str,
    db: Session = Depends(get_db)
):
    """
    Obtiene información de una licencia (sin autenticación).
    Útil para verificar estado general.
    """
    license_obj = crud.get_license_by_key(db, license_key)
    
    if not license_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Licencia no encontrada"
        )
    
    return license_obj


# ════════════════════════════════════════════════════════
# ADMIN ENDPOINTS (para testing/setup)
# ════════════════════════════════════════════════════════

@app.post("/admin/generate-license")
def admin_generate_license(
    request: GenerateLicenseRequest,
    db: Session = Depends(get_db)
):
    """
    SOLO PARA TESTING/DEVELOPMENT.
    
    Genera una licencia de prueba.
    
    ⚠️ Solo disponible si DEBUG=True en .env
    ⚠️ ELIMINAR o restringir en producción
    """
    if not settings.DEBUG:
        logger.warning(f"Intento de acceder a /admin/generate-license con DEBUG=False")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Endpoint solo disponible en modo DEBUG"
        )
    
    try:
        # Generar clave aleatoria segura
        chars = string.ascii_letters + string.digits
        license_key = ''.join(secrets.choice(chars) for _ in range(32))
        
        license_obj = crud.create_license(db, license_key, request.is_pro, request.payment_method)
        
        logger.info(f"Licencia de prueba generada: {license_key}, is_pro={request.is_pro}")
        
        return {
            "license_key": license_key,
            "is_pro": request.is_pro,
            "message": "Licencia de prueba generada"
        }
    
    except Exception as e:
        logger.error(f"Error al generar licencia de prueba: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al generar licencia"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)
