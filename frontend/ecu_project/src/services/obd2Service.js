// Detectamos si la app corre desde archivos locales (Electron .exe) o desde la web (Vite dev)
// En desarrollo: window.location.protocol será 'http:' o 'https:'
// En producción (.exe): window.location.protocol será 'file:' así que usamos la URL completa
const isDevFrontend = window.location.protocol === 'http:' || window.location.protocol === 'https:';

const API_BASE = isDevFrontend ? '/api' : 'http://127.0.0.1:5000/api';

console.log(`[OBD2Service] Conectando a: ${API_BASE} (${isDevFrontend ? 'Desarrollo' : 'Producción'})`);



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

export async function escanearProtocolo() {
  try {
    const response = await fetch(`${API_BASE}/protocolo/escanear`);
    if (!response.ok) throw new Error('Error al escanear protocolo');
    return await response.json();
  } catch (error) {
    return { error: 'No se pudo detectar protocolo' };
  }
}

export async function getProtocoloActual() {
  try {
    const response = await fetch(`${API_BASE}/protocolo`);
    if (!response.ok) throw new Error('Error al obtener protocolo');
    return await response.json();
  } catch (error) {
    return { error: 'No se pudo obtener protocolo' };
  }
}
