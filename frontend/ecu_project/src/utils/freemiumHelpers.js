/**
 * Helpers para el modelo FREEMIUM
 * 
 * - getVisibleFaults: Filtrar fallas según modo FREE/PRO
 * - canDeleteFaults: Verificar si puede borrar
 */

/**
 * Retorna fallas visibles según estado PRO
 * 
 * FREE: solo 1 falla
 * PRO: todas las fallas
 */
export function getVisibleFaults(faults, isPro) {
  if (!faults || faults.length === 0) return [];
  
  // Si es PRO, mostrar todas
  if (isPro) {
    return faults;
  }
  
  // Si es FREE, mostrar solo la primera (más crítica)
  return faults.slice(0, 1);
}

/**
 * Verifica si puede borrar códigos
 * Solo PRO puede borrar
 */
export function canDeleteFaults(isPro) {
  return isPro === true;
}

/**
 * Genera mensaje de "más fallas disponibles"
 */
export function getMoreFaultsMessage(currentCount, totalCount, isPro) {
  if (isPro) return null;
  
  const remaining = totalCount - currentCount;
  if (remaining <= 0) return null;
  
  return `+${remaining} falla${remaining > 1 ? 's' : ''} disponible${remaining > 1 ? 's' : ''} en versión PRO`;
}

export default {
  getVisibleFaults,
  canDeleteFaults,
  getMoreFaultsMessage
};
