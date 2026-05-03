# 🚀 Integración de Sistema de Licencias - Frontend

## Resumen

Sistema completo de licencias para React/Electron con:
- ✅ Validación automática de licencias
- ✅ Bloqueo/desbloqueo de features
- ✅ Interfaz de activación
- ✅ Persistencia en localStorage
- ✅ Validación periódica (cada 24h)

---

## 📁 Archivos Creados

### Servicios
- **`src/services/licenseService.js`** - API para comunicar con backend
  - `activate(key, deviceId)` - Activar licencia
  - `validate(key, deviceId)` - Validar estado
  - `transfer(key, newDeviceId)` - Transferir dispositivo
  - `getInfo(key)` - Info de licencia
  - `isValidFormat(key)` - Validar formato
  - `isServerOnline()` - Health check

### Hooks
- **`src/hooks/useLicense.js`** - Hook React para gestión de estado
  - Maneja estado de licencia (FREE/PRO/INVALID/LOADING)
  - Valida automáticamente al iniciar
  - Revalida cada 24 horas
  - Guarda en localStorage

### Componentes
- **`src/components/LicenseActivation.jsx`** - Modal para activar
  - Input para ingresar clave
  - Validación de formato
  - Muestra características PRO
  
- **`src/components/ProtectedFeature.jsx`** - Envoltorio para features PRO
  - Bloquea contenido si no es PRO
  - Muestra overlay con opción de upgrade
  - Acepta fallback para versión gratuita

### Ejemplo
- **`src/pages/ExampleIntegration.jsx`** - Ejemplo completo de integración

### Estilos
- **`src/styles/LicenseActivation.css`**
- **`src/styles/ProtectedFeature.css`**
- **`src/styles/ExampleIntegration.css`**

---

## 🔧 Cómo Usar

### 1. Importar en tu App

```jsx
import useLicense from "./hooks/useLicense";
import LicenseActivation from "./components/LicenseActivation";
import ProtectedFeature from "./components/ProtectedFeature";
```

### 2. Usar el Hook

```jsx
function MyComponent() {
  const license = useLicense();

  // Estados disponibles
  console.log(license.status);        // LOADING | FREE | PRO | INVALID | NO_LICENSE
  console.log(license.isPro);         // boolean
  console.log(license.deviceId);      // string único
  console.log(license.isValidating);  // boolean

  return (
    <div>
      {license.isPro && <p>✅ Eres PRO!</p>}
      {!license.isPro && <p>📋 Versión gratuita</p>}
    </div>
  );
}
```

### 3. Bloquear Features

```jsx
<ProtectedFeature
  isPro={license.isPro}
  featureName="Ver todos los códigos"
  onUpgrade={() => setShowModal(true)}
>
  <YourProComponent />
</ProtectedFeature>
```

### 4. Modal de Activación

```jsx
const [showModal, setShowModal] = useState(false);

<LicenseActivation
  onActivate={license.activateLicense}
  isLoading={license.isValidating}
/>
```

---

## 📊 Estados de Licencia

| Estado | Significado | isPro |
|--------|------------|-------|
| `LOADING` | Validando licencia | - |
| `PRO` | Licencia válida PRO | ✅ true |
| `FREE` | Sin licencia PRO | ❌ false |
| `INVALID` | Error en validación | ❌ false |
| `NO_LICENSE` | Sin clave ingresada | ❌ false |

---

## 🔄 Flujo Completo

```
1. User abre app
   ↓
2. Hook useLicense() lee localStorage
   ↓
3. Si hay license_key, valida con backend (/license/status)
   ↓
4. Backend responde {valid, is_pro}
   ↓
5. Estado se actualiza → UI se renderiza
   ↓
6. Si no es PRO, mostrar features bloqueadas
   ↓
7. User presiona "Desbloquear PRO"
   ↓
8. Modal LicenseActivation aparece
   ↓
9. User ingresa clave → POST /license/activate
   ↓
10. Backend asigna device_id y responde
   ↓
11. Hook revalida → isPro = true
   ↓
12. Features se desbloquean ✅
```

---

## 💾 localStorage

Se guarda automáticamente:

```json
{
  "license_key": "ABC123...XYZ456",
  "device_id": "DEVICE_1234567890_ABCDEFGH",
  "last_validated": "2026-05-03T15:30:00.000Z"
}
```

---

## 🧪 Testing

### Generar licencia de prueba (backend)

```bash
curl -X POST http://localhost:5000/admin/generate-license?is_pro=true
```

Respuesta:
```json
{
  "license_key": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "is_pro": true,
  "message": "Licencia de prueba generada"
}
```

### Probar en frontend

```jsx
// Copiar license_key generada
const testKey = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

// Usarlo en modal o directamente
const license = useLicense();
await license.activateLicense(testKey);
```

---

## 🚨 Validación

### Formato de clave
- 32 caracteres alfanuméricos
- Regex: `/^[a-zA-Z0-9]{32}$/`

### Device ID
- Generado automáticamente si no existe
- Guardado en localStorage
- Formato: `DEVICE_<timestamp>_<random>`

### Validación periódica
- Se ejecuta al iniciar
- Se ejecuta cada 24 horas automáticamente
- Se puede forzar manualmente: `license.validateLicense()`

---

## 🔐 Seguridad

✅ **Implementado:**
- Validación en backend (no client-side)
- Device ID único vinculado a clave
- Último acceso registrado
- Transacciones atómicas en BD
- Limitación de transferencias (futuro)

❌ **No implementado (MVP):**
- Rate limiting
- Validación de JWT
- Encriptación de localStorage
- Detección de cracking

---

## 🔗 Integración con tu App

### En Home.jsx

```jsx
import useLicense from "../hooks/useLicense";

export default function Home() {
  const license = useLicense();

  return (
    <>
      <h1>Dashboard</h1>
      
      <button>
        Escanear (siempre disponible)
      </button>

      <ProtectedFeature isPro={license.isPro}>
        <button>Borrar Códigos (PRO ONLY)</button>
      </ProtectedFeature>
    </>
  );
}
```

---

## 📝 Checklist de Implementación

- [ ] Copiar `src/services/licenseService.js`
- [ ] Copiar `src/hooks/useLicense.js`
- [ ] Copiar componentes (LicenseActivation, ProtectedFeature)
- [ ] Copiar estilos CSS
- [ ] Importar hook en componentes principales
- [ ] Envolver features PRO con ProtectedFeature
- [ ] Probar con licencia de prueba
- [ ] Configurar URL backend (.env)

---

## 🌍 Variables de Ambiente

```bash
# .env
REACT_APP_LICENSE_API_URL=http://localhost:5000
```

O para producción:
```bash
REACT_APP_LICENSE_API_URL=https://api.obd2diag.com
```

---

## 📈 Próximos Pasos

1. **Testing:** Probar flujo completo (activate → status → transfer)
2. **Integración:** Conectar con tu App principal
3. **Webhooks:** Implementar pagos (Flow/Stripe)
4. **Rate Limiting:** Proteger backend de abuso
5. **Monitoring:** Agregar logs y alertas

---

**Status:** MVP funcional ✅  
**Última actualización:** 2026-05-03
