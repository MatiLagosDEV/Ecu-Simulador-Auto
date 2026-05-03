# Backend FastAPI - OBD2 Licencias

Sistema de gestión de licencias para la aplicación OBD2 Diagnóstico Automotriz.

## 📦 Instalación

### 1. Clonar/descargar proyecto
```bash
cd backend
```

### 2. Crear ambiente virtual
```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
```

### 3. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 4. Configurar .env
```bash
cp .env.example .env
# Editar .env con tus datos de BD
```

### 5. Configurar PostgreSQL

**Opción A: PostgreSQL local**
```bash
# Crear BD
createdb obd2_licencias -U postgres

# Ejecutar script de inicialización
psql -U postgres -d obd2_licencias -f init.sql
```

**Opción B: PostgreSQL en Docker**
```bash
docker run --name obd2-db -e POSTGRES_PASSWORD=obd2_password -e POSTGRES_DB=obd2_licencias -p 5432:5432 -d postgres:16
```

## 🚀 Ejecutar

```bash
python -m app.main
```

La API estará en: `http://localhost:5000`

Documentación interactiva: `http://localhost:5000/docs`

## 📚 Endpoints

### `/license/activate` (POST)
Activa una licencia en un dispositivo.

**Request:**
```json
{
  "license_key": "ABC123...",
  "device_id": "DEVICE_XYZ_123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Licencia activada",
  "requires_transfer": false
}
```

### `/license/status` (POST)
Valida si una licencia es válida para este dispositivo.

**Request:**
```json
{
  "license_key": "ABC123...",
  "device_id": "DEVICE_XYZ_123"
}
```

**Response:**
```json
{
  "valid": true,
  "is_pro": true,
  "message": null
}
```

### `/license/transfer` (POST)
Transfiere licencia a otro dispositivo.

**Request:**
```json
{
  "license_key": "ABC123...",
  "device_id_nuevo": "DEVICE_ABC_456",
  "razon": "cambio_pc"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Licencia transferida",
  "device_id_anterior": "DEVICE_XYZ_123",
  "device_id_nuevo": "DEVICE_ABC_456"
}
```

### `/license/info/{license_key}` (GET)
Obtiene información de una licencia.

**Response:**
```json
{
  "license_key": "ABC123...",
  "is_pro": true,
  "device_id_actual": "DEVICE_XYZ_123",
  "created_at": "2026-05-03T10:00:00",
  "expires_at": null
}
```

### `/admin/generate-license` (POST - TESTING)
Genera licencia de prueba (solo en DEBUG=True).

## 🧪 Testing

```bash
pytest tests/
```

## 📝 Notas

- Licencias de prueba creadas en `init.sql`
- Endpoint `/admin/generate-license` solo disponible si `DEBUG=True`
- No hay autenticación por ahora (solo claves)
- Base de datos se crea automáticamente al iniciar

## 🔄 Flujo típico

1. Usuario compra → Se genera `license_key`
2. Usuario instala app → Sistema genera `device_id`
3. Usuario ingresa clave → `/license/activate`
4. App valida cada 24h → `/license/status`
5. Usuario cambia PC → `/license/transfer`

---

**Estado:** MVP funcional  
**Última actualización:** 2026-05-03
