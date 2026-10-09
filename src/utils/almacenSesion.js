import AsyncStorage from '@react-native-async-storage/async-storage';

export const TIEMPO_ALMACEN_MS = 3000;

// Garantiza que la promesa siempre se resuelva o rechace en tiempo límite, evitando cuelgues del hilo JS en iOS.
export const conTiempoLimite = (promesa, ms = TIEMPO_ALMACEN_MS, etiqueta = 'operación') => {
  let temporizador;
  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error(`Tiempo agotado: ${etiqueta}`)), ms);
  });
  return Promise.race([Promise.resolve(promesa), limite]).finally(() => clearTimeout(temporizador));
};

// Lectura que nunca lanza ni reintenta en bucle: ante cualquier fallo devuelve null inmediatamente.
export const leerSesion = async (clave) => {
  if (!clave || typeof clave !== 'string') return null;
  try {
    const valor = await conTiempoLimite(AsyncStorage.getItem(clave), TIEMPO_ALMACEN_MS, `leer ${clave}`);
    return valor ?? null;
  } catch (error) {
    console.warn(`[sesion] Error o timeout al leer ${clave}:`, error?.message || error);
    return null;
  }
};

// Lectura múltiple que devuelve un objeto { [clave]: valor|null } sin lanzar ni ciclar.
export const leerSesionMultiple = async (claves) => {
  if (!Array.isArray(claves) || claves.length === 0) return {};
  const vacio = Object.fromEntries(claves.map((clave) => [clave, null]));
  try {
    const pares = await conTiempoLimite(AsyncStorage.multiGet(claves), TIEMPO_ALMACEN_MS, 'leer sesión');
    if (!Array.isArray(pares)) return vacio;
    return { ...vacio, ...Object.fromEntries(pares) };
  } catch (error) {
    console.warn('[sesion] Error o timeout en lectura múltiple:', error?.message || error);
    return vacio;
  }
};

// Escritura con tiempo límite; devuelve true/false y no lanza.
export const guardarSesion = async (pares) => {
  if (!Array.isArray(pares) || pares.length === 0) return false;
  try {
    await conTiempoLimite(AsyncStorage.multiSet(pares), TIEMPO_ALMACEN_MS, 'guardar sesión');
    return true;
  } catch (error) {
    console.warn('[sesion] Error al guardar sesión:', error?.message || error);
    return false;
  }
};

export const limpiarSesion = async () => {
  try {
    await conTiempoLimite(AsyncStorage.clear(), TIEMPO_ALMACEN_MS, 'limpiar sesión');
    return true;
  } catch (error) {
    console.warn('[sesion] Error al limpiar sesión:', error?.message || error);
    return false;
  }
};

