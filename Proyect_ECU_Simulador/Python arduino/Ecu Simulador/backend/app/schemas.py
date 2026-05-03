from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class LicenseActivateRequest(BaseModel):
    """Request para activar licencia"""
    license_key: str = Field(..., min_length=30, max_length=32)
    device_id: str = Field(..., min_length=1)


class LicenseStatusRequest(BaseModel):
    """Request para validar estado"""
    license_key: str = Field(..., min_length=30, max_length=32)
    device_id: str = Field(..., min_length=1)


class LicenseTransferRequest(BaseModel):
    """Request para transferir licencia"""
    license_key: str = Field(..., min_length=30, max_length=32)
    device_id_nuevo: str = Field(..., min_length=1)
    razon: Optional[str] = "cambio_pc"


class LicenseResponse(BaseModel):
    """Response de licencia"""
    license_key: str
    is_pro: bool
    device_id_actual: Optional[str]
    created_at: datetime


class GenerateLicenseRequest(BaseModel):
    """Request para generar licencia de prueba (admin)"""
    is_pro: bool = False
    payment_method: str = "prueba"
    expires_at: Optional[datetime] = None
    expires_at: Optional[datetime]

    class Config:
        from_attributes = True


class StatusResponse(BaseModel):
    """Response de validación de estado"""
    valid: bool
    is_pro: bool
    message: Optional[str] = None


class ActivateResponse(BaseModel):
    """Response de activación"""
    success: bool
    message: str
    requires_transfer: bool = False


class TransferResponse(BaseModel):
    """Response de transferencia"""
    success: bool
    message: str
    device_id_anterior: Optional[str]
    device_id_nuevo: str
