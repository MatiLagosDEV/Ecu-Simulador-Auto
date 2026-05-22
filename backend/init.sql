-- ═══════════════════════════════════════════════════════════
-- SCRIPT DE INICIALIZACIÓN - OBD2 Licencias
-- ═══════════════════════════════════════════════════════════
-- Ejecutar en PostgreSQL con:
-- psql -U postgres -d obd2_licencias -f init.sql
-- ═══════════════════════════════════════════════════════════

-- Crear tablas
CREATE TABLE licencias (
  id SERIAL PRIMARY KEY,
  license_key VARCHAR(32) UNIQUE NOT NULL,
  device_id_actual VARCHAR(255),
  is_pro BOOLEAN DEFAULT FALSE,
  payment_method VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_validated TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE TABLE pagos (
  id SERIAL PRIMARY KEY,
  license_key VARCHAR(32) NOT NULL,
  FOREIGN KEY (license_key) REFERENCES licencias(license_key),
  payment_id VARCHAR(255) UNIQUE NOT NULL,
  provider VARCHAR(20) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transfers (
  id SERIAL PRIMARY KEY,
  license_key VARCHAR(32) NOT NULL,
  FOREIGN KEY (license_key) REFERENCES licencias(license_key),
  device_id_anterior VARCHAR(255),
  device_id_nuevo VARCHAR(255) NOT NULL,
  razon VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices
CREATE INDEX idx_license_key ON licencias(license_key);
CREATE INDEX idx_device ON licencias(device_id_actual);
CREATE INDEX idx_is_pro ON licencias(is_pro);
CREATE INDEX idx_payment_id ON pagos(payment_id);
CREATE INDEX idx_provider ON pagos(provider);
CREATE INDEX idx_status ON pagos(status);
CREATE INDEX idx_transfer_key ON transfers(license_key);
CREATE INDEX idx_transfer_created ON transfers(created_at);

-- Insertar licencias de prueba (solo desarrollo)
INSERT INTO licencias (license_key, is_pro, payment_method)
VALUES
  ('PRUEBA001PRUEBA001PRUEBA001PREBA01', true, 'prueba'),
  ('PRUEBA002PRUEBA002PRUEBA002PREBA02', false, 'prueba');

COMMIT;
