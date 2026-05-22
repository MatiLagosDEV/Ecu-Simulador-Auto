from sqlalchemy.orm import Session
from sqlalchemy import select, update
from app.models import Licencia, Transfer
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def get_license_by_key(db: Session, license_key: str):
    """Obtiene licencia por clave"""
    return db.query(Licencia).filter(Licencia.license_key == license_key).first()


def create_license(db: Session, license_key: str, is_pro: bool = False, payment_method: str = None):
    """Crea una nueva licencia"""
    db_license = Licencia(
        license_key=license_key,
        is_pro=is_pro,
        payment_method=payment_method
    )
    db.add(db_license)
    db.commit()
    db.refresh(db_license)
    logger.info(f"Licencia creada: {license_key}, is_pro={is_pro}")
    return db_license


def activate_license(db: Session, license_key: str, device_id: str):
    """
    Activa licencia en un device DE FORMA ATÓMICA.
    
    CRÍTICO: Usa UPDATE a nivel SQL con condición WHERE para evitar race conditions.
    
    Lógica:
    - Si no tiene device → asigna (UPDATE con condición device_id_actual IS NULL)
    - Si tiene el MISMO device → OK (solo actualiza timestamp)
    - Si tiene OTRO device → NO activa, requiere transferencia
    """
    try:
        license_obj = get_license_by_key(db, license_key)
        
        if not license_obj:
            logger.warning(f"Intento de activar licencia no encontrada: {license_key}")
            return None, "Licencia no encontrada"
        
        # Caso 1: Mismo device, solo actualizar timestamp
        if license_obj.device_id_actual == device_id:
            license_obj.last_validated = datetime.utcnow()
            db.commit()
            logger.debug(f"Licencia {license_key} re-validada en device {device_id}")
            return license_obj, "Licencia válida en este dispositivo"
        
        # Caso 2: Otro device, rechazar
        if license_obj.device_id_actual is not None:
            logger.info(f"Intento de activar licencia {license_key} desde device {device_id}, "
                       f"pero ya está en {license_obj.device_id_actual}")
            return license_obj, "Licencia en otro dispositivo. Requiere transferencia"
        
        # Caso 3: Sin asignar, asignar de forma ATÓMICA usando UPDATE SQL
        # Esta operación es atómica a nivel BD
        stmt = update(Licencia).where(
            (Licencia.license_key == license_key) & 
            (Licencia.device_id_actual.is_(None))  # Condición crucial para atomicidad
        ).values(
            device_id_actual=device_id,
            last_validated=datetime.utcnow()
        )
        
        result = db.execute(stmt)
        db.commit()
        
        # Verificar si el UPDATE tuvo efecto (rowcount)
        if result.rowcount == 0:
            # Otra petición la activó simultáneamente
            logger.warning(f"Race condition detectada en activate: {license_key} ya fue activada")
            db.refresh(license_obj)
            return license_obj, "Licencia en otro dispositivo. Requiere transferencia"
        
        if result.rowcount == 1:
            # Éxito - actualizar el objeto local
            db.refresh(license_obj)
            logger.info(f"Licencia {license_key} activada en device {device_id}")
            return license_obj, "Licencia activada"
        
        logger.error(f"UPDATE inesperado: {result.rowcount} filas afectadas")
        return None, "Error inesperado"
    
    except Exception as e:
        logger.error(f"Error al activar licencia {license_key}: {str(e)}")
        db.rollback()
        return None, f"Error al activar licencia"


def transfer_license(db: Session, license_key: str, device_id_nuevo: str, razon: str = "cambio_pc"):
    """
    Transfiere licencia a otro device.
    
    - Actualiza device_id_actual
    - Registra cambio en tabla transfers (auditoría)
    - Retorna datos del cambio
    """
    try:
        license_obj = get_license_by_key(db, license_key)
        
        if not license_obj:
            logger.warning(f"Intento de transferir licencia no encontrada: {license_key}")
            return None, "Licencia no encontrada"
        
        device_id_anterior = license_obj.device_id_actual
        
        # Crear registro en transfers (auditoría)
        transfer = Transfer(
            license_key=license_key,
            device_id_anterior=device_id_anterior,
            device_id_nuevo=device_id_nuevo,
            razon=razon
        )
        db.add(transfer)
        
        # Actualizar licencia
        license_obj.device_id_actual = device_id_nuevo
        license_obj.last_validated = datetime.utcnow()
        
        db.commit()
        db.refresh(license_obj)
        
        logger.info(f"Licencia {license_key} transferida de {device_id_anterior} a {device_id_nuevo}")
        return license_obj, "Licencia transferida"
    
    except Exception as e:
        logger.error(f"Error al transferir licencia {license_key}: {str(e)}")
        db.rollback()
        return None, f"Error al transferir licencia: {str(e)}"


def validate_license(db: Session, license_key: str, device_id: str):
    """
    Valida si una licencia es válida para este device.
    
    Verifica:
    1. Licencia existe
    2. device_id coincide
    3. no está expirada
    4. es_pro (True/False)
    
    Retorna: (es_válida, es_pro)
    """
    try:
        license_obj = get_license_by_key(db, license_key)
        
        if not license_obj:
            logger.debug(f"Validación fallida: licencia {license_key} no existe")
            return False, False
        
        # Validar device coincida
        if license_obj.device_id_actual != device_id:
            logger.debug(f"Validación fallida: device mismatch. Key={license_key}, "
                        f"esperado={license_obj.device_id_actual}, actual={device_id}")
            return False, False
        
        # Validar expiración
        if license_obj.expires_at and datetime.utcnow() > license_obj.expires_at:
            logger.warning(f"Licencia {license_key} expirada en device {device_id}")
            return False, False
        
        # Actualizar último acceso (auditoría)
        license_obj.last_validated = datetime.utcnow()
        db.commit()
        
        # IMPORTANTE: retornar is_pro true SOLO si licencia es válida y is_pro=True
        is_pro = license_obj.is_pro if license_obj.is_pro else False
        
        logger.debug(f"Licencia {license_key} validada. is_pro={is_pro}")
        return True, is_pro
    
    except Exception as e:
        logger.error(f"Error al validar licencia {license_key}: {str(e)}")
        return False, False

