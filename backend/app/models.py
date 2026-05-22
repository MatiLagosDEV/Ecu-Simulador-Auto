from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, ForeignKey, JSON
from sqlalchemy.sql import func
from app.database import Base


class Licencia(Base):
    """Modelo de licencias"""
    __tablename__ = "licencias"

    id = Column(Integer, primary_key=True, index=True)
    license_key = Column(String(40), unique=True, nullable=False, index=True)
    device_id_actual = Column(String(255), nullable=True, index=True)
    is_pro = Column(Boolean, default=False, index=True)
    payment_method = Column(String(20), nullable=True)  # 'flow', 'stripe', 'prueba'
    created_at = Column(DateTime, server_default=func.now())
    last_validated = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)


class Pago(Base):
    """Modelo de pagos (auditoría de transacciones)"""
    __tablename__ = "pagos"

    id = Column(Integer, primary_key=True, index=True)
    license_key = Column(String(40), ForeignKey("licencias.license_key"), nullable=False)
    payment_id = Column(String(255), unique=True, nullable=False, index=True)
    provider = Column(String(20), nullable=False, index=True)  # 'stripe', 'flow'
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), nullable=False)  # 'CLP', 'USD'
    status = Column(String(20), default="pending", index=True)  # 'completed', 'failed'
    payment_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Transfer(Base):
    """Modelo de transferencias de dispositivo"""
    __tablename__ = "transfers"

    id = Column(Integer, primary_key=True, index=True)
    license_key = Column(String(40), ForeignKey("licencias.license_key"), nullable=False)
    device_id_anterior = Column(String(255), nullable=True)
    device_id_nuevo = Column(String(255), nullable=False)
    razon = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)
