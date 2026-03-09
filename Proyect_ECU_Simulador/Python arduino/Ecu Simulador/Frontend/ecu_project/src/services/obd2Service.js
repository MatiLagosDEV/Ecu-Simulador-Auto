const VIN_URL = 'http://localhost:5000/vin';
export async function getVinObd2() {
  try {
    const response = await fetch(VIN_URL);
    if (!response.ok) throw new Error('Error al obtener VIN');
    return await response.json();
  } catch (error) {
    return { error: 'No se pudo obtener VIN' };
  }
}
// src/services/obd2Service.js

const API_URL = 'http://localhost:5000/datos';
const MOTOR_URL = 'http://localhost:5000/motor/toggle';

export async function getDatosObd2() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Error al obtener datos');
    return await response.json();
  } catch (error) {
    return { error: 'No se pudo obtener datos' };
  }
}

export async function toggleMotor() {
  try {
    const response = await fetch(MOTOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Error al cambiar estado del motor');
    return await response.json();
  } catch (error) {
    return { error: 'No se pudo cambiar estado del motor' };
  }
}
