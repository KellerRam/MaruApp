import AsyncStorage from '@react-native-async-storage/async-storage';

export const TIEMPO_ALMACEN_MS = 4000;

// Garantiza que la promesa siempre se resuelva o rechace, aunque la capa nativa nunca responda.
export const conTiempoLimite = (promesa, ms = TIEMPO_ALMACEN_MS, etiqueta = 'operación') => {
  let temporizador;
  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error(`Tiempo agotado: ${etiqueta}`)), ms);
  });
  return Promise.race([Promise.resolve(promesa), limite]).finally(() => clearTimeout(temporizador));
};

// Lectura que nunca lanza ni se cuelga: ante fallo devuelve null.
export const leerSesion = async (clave) => {
  try {
    return await conTiempoLimite(AsyncStorage.getItem(clave), TIEMPO_ALMACEN_MS, `leer ${clave}`);
  } catch (error) {
    console.warn(`[sesion] ${error.message}`);
    return null;
  }
};

// Lectura múltiple que devuelve un objeto { clave: valor|null } sin lanzar.
export const leerSesionMultiple = async (claves) => {
  const vacio = Object.fromEntries(claves.map((clave) => [clave, null]));
  try {
    const pares = await conTiempoLimite(AsyncStorage.multiGet(claves), TIEMPO_ALMACEN_MS, 'leer sesión');
    return { ...vacio, ...Object.fromEntries(pares) };
  } catch (error) {
    console.warn(`[sesion] ${error.message}`);
    return vacio;
  }
};

// Escritura con tiempo límite; devuelve true/false y no lanza.
export const guardarSesion = async (pares) => {
  try {
    await conTiempoLimite(AsyncStorage.multiSet(pares), TIEMPO_ALMACEN_MS, 'guardar sesión');
    return true;
  } catch (error) {
    console.warn(`[sesion] ${error.message}`);
    return false;
  }
};

export const limpiarSesion = async () => {
  try {
    await conTiempoLimite(AsyncStorage.clear(), TIEMPO_ALMACEN_MS, 'limpiar sesión');
    return true;
  } catch (error) {
    console.warn(`[sesion] ${error.message}`);
    return false;
  }
};
