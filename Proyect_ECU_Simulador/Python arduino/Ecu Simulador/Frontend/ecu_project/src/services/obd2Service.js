// Todas las URLs usan rutas relativas (/api/...) que Vite redirige al backend Flask.
// Esto evita los errores ERR_CONNECTION_REFUSED en la consola del navegador
// cuando el servidor está apagado.
const API_BASE = '/api';

export async function getVinObd2() {
  try {
    const response = await fetch(`${API_BASE}/vin`);
    if (!response.ok) throw new Error('Error al obtener VIN');
    return await response.json();
  } catch (error) {
    return { error: 'No se pudo obtener VIN' };
  }
}

export async function getDatosObd2() {
  try {
    const response = await fetch(`${API_BASE}/datos`);
    if (!response.ok) throw new Error('Error al obtener datos');
    return await response.json();
  } catch (error) {
    return { error: 'No se pudo obtener datos' };
  }
}

export async function toggleMotor() {
  try {
    const response = await fetch(`${API_BASE}/motor/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Error al cambiar estado del motor');
    return await response.json();
  } catch (error) {
    return { error: 'No se pudo cambiar estado del motor' };
  }
}

export async function getEstadoMotor() {
  try {
    const response = await fetch(`${API_BASE}/estado-motor`);
    if (!response.ok) throw new Error('Error al obtener estado');
    return await response.json();
  } catch (error) {
    return { error: 'No se pudo obtener estado del motor', estado: 'APAGADO', rpm: 0, voltaje: 0 };
  }
}

export async function escanearCodigos() {
  try {
    const response = await fetch(`${API_BASE}/codigos`);
    if (!response.ok) throw new Error('Error al escanear');
    return await response.json();
  } catch (error) {
    return { error: 'No se pudo escanear' };
  }
}

export async function borrarCodigos() {
  try {
    const response = await fetch(`${API_BASE}/codigos/borrar`, { method: 'POST' });
    if (!response.ok) throw new Error('Error al borrar');
    return await response.json();
  } catch (error) {
    return { error: 'No se pudo borrar códigos' };
  }
}
