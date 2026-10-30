import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { API_URL } from '../config/api';

// Sesión persistente multiplataforma (Android e iOS).
// - Claves en AsyncStorage: 'userToken', 'userId', 'tieneGrupo' (y 'groupId', que guardan otras pantallas).
// - La sesión vive también en memoria: tras cargarla una vez, ninguna petición vuelve a esperar al
//   almacenamiento, y toda lectura/escritura tiene un límite de tiempo para no dejar la app colgada.
const CLAVE_TOKEN = 'userToken';
const CLAVE_ID_USUARIO = 'userId';
const CLAVE_TIENE_GRUPO = 'tieneGrupo';
const CLAVE_ID_GRUPO = 'groupId';
const API_BASE = API_URL.replace(/\/+$/, '');
const LIMITE_ALMACENAMIENTO_MS = 4000;

// Mensajes que devuelve el middleware de autenticación del servidor cuando el token no sirve.
const MENSAJES_SESION_INVALIDA = ['Debes iniciar sesión', 'La sesión no es válida'];
export const esErrorDeSesion = (mensaje) =>
  typeof mensaje === 'string' && MENSAJES_SESION_INVALIDA.some((inicio) => mensaje.startsWith(inicio));

const oyentes = new Set();
const oyentesExpiracion = new Set();

let sesion = null; // { token, idUsuario, tieneGrupo }
let cargada = false; // true cuando el estado en memoria ya es el definitivo
let cargaEnCurso = null;
let generacion = 0; // cambia en cada inicio/cierre de sesión para descartar lecturas obsoletas
let expirando = false;

// Espera una promesa como máximo `ms`; si falla o tarda más, devuelve `valor`. Nunca rechaza ni se cuelga.
export const conLimite = (promesa, ms, valor = null) =>
  new Promise((resolver) => {
    const temporizador = setTimeout(() => resolver(valor), ms);
    Promise.resolve(promesa).then(
      (resultado) => {
        clearTimeout(temporizador);
        resolver(resultado);
      },
      () => {
        clearTimeout(temporizador);
        resolver(valor);
      }
    );
  });

// Permite que componentes montados descarten su estado en memoria al cerrar sesión.
export const alCerrarSesion = (oyente) => {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
};

// Permite a la navegación reaccionar cuando el servidor invalida la sesión (token vencido).
export const alExpirarSesion = (oyente) => {
  oyentesExpiracion.add(oyente);
  return () => oyentesExpiracion.delete(oyente);
};

const notificar = (conjunto, etiqueta) => {
  conjunto.forEach((oyente) => {
    try {
      oyente();
    } catch (error) {
      console.warn(`Error en oyente de ${etiqueta}:`, error.message);
    }
  });
};

// Si el token no se puede decodificar se considera vigente: el servidor decide con un 401.
const tokenVencido = (token) => {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const relleno = parte + '='.repeat((4 - (parte.length % 4)) % 4);
    const { exp } = JSON.parse(globalThis.atob(relleno));
    return typeof exp === 'number' && exp * 1000 <= Date.now();
  } catch {
    return false;
  }
};

// Lee la sesión guardada (una sola vez por arranque) y la deja en memoria.
// Resuelve con la sesión o null; nunca rechaza y tarda como máximo LIMITE_ALMACENAMIENTO_MS.
export const cargarSesionGuardada = () => {
  if (cargada) return Promise.resolve(sesion);
  if (!cargaEnCurso) {
    const generacionLectura = generacion;
    cargaEnCurso = conLimite(
      AsyncStorage.multiGet([CLAVE_TOKEN, CLAVE_ID_USUARIO, CLAVE_TIENE_GRUPO, CLAVE_ID_GRUPO]),
      LIMITE_ALMACENAMIENTO_MS,
      null
    )
      .then((pares) => {
        if (generacionLectura !== generacion) return sesion; // se inició/cerró sesión mientras se leía
        if (!pares) return null; // no se pudo leer: se reintentará en la próxima consulta
        const datos = Object.fromEntries(pares);
        const token = datos[CLAVE_TOKEN];
        const idUsuario = datos[CLAVE_ID_USUARIO];
        if (token && idUsuario && !tokenVencido(token)) {
          sesion = {
            token,
            idUsuario,
            tieneGrupo: datos[CLAVE_TIENE_GRUPO] === 'true' || Boolean(datos[CLAVE_ID_GRUPO]),
          };
        } else {
          sesion = null;
          if (token || idUsuario) AsyncStorage.clear().catch(() => {}); // sesión incompleta o vencida
        }
        cargada = true;
        return sesion;
      })
      .finally(() => {
        cargaEnCurso = null;
      });
  }
  return cargaEnCurso;
};

// Token de la sesión activa (desde memoria; solo la primera vez consulta el almacenamiento).
export const obtenerToken = async () => {
  if (sesion) return sesion.token;
  if (!cargada) await cargarSesionGuardada();
  return sesion ? sesion.token : null;
};

export const guardarSesion = async ({ token, idUsuario, tieneGrupo = false }) => {
  generacion += 1;
  expirando = false;
  cargada = true;
  sesion = { token, idUsuario: String(idUsuario), tieneGrupo: Boolean(tieneGrupo) };
  try {
    await conLimite(
      AsyncStorage.multiSet([
        [CLAVE_TOKEN, token],
        [CLAVE_ID_USUARIO, String(idUsuario)],
        [CLAVE_TIENE_GRUPO, tieneGrupo ? 'true' : 'false'],
      ]),
      LIMITE_ALMACENAMIENTO_MS
    );
  } catch (error) {
    console.warn('No se pudo guardar la sesión:', error.message);
  }
};

// Desvincula el dispositivo del usuario para que no reciba notificaciones de una cuenta ya cerrada.
const desregistrarTokenPush = (previa) => {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 5000);
  globalThis
    .fetch(`${API_BASE}/api/notifications/push-token/${previa.idUsuario}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${previa.token}` },
      signal: controlador.signal,
    })
    .catch(() => {})
    .finally(() => clearTimeout(temporizador));
};

// Borra todo lo guardado salvo el aviso de tutorial ya visto (para no repetirlo en cada inicio de sesión).
const PREFIJO_TUTORIAL_VISTO = 'tutorialVisto_';
const limpiarAlmacenamiento = async () => {
  const claves = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(claves.filter((clave) => !clave.startsWith(PREFIJO_TUTORIAL_VISTO)));
};

// Cierre inmediato: primero memoria, luego pantallas, luego almacenamiento; la red va en segundo plano.
export const cerrarSesion = async ({ notificarServidor = true } = {}) => {
  const previa = sesion;
  generacion += 1;
  sesion = null;
  cargada = true;

  notificar(oyentes, 'cierre de sesión');

  await conLimite(limpiarAlmacenamiento(), LIMITE_ALMACENAMIENTO_MS);

  GoogleSignin.signOut().catch(() => {
    // Sin sesión de Google activa no hay nada que cerrar.
  });
  if (notificarServidor && previa) desregistrarTokenPush(previa);
};

// El servidor rechazó el token (401): se limpia la sesión una sola vez y se avisa a la navegación.
export const expirarSesion = async (tokenRechazado) => {
  if (expirando || !sesion || sesion.token !== tokenRechazado) return; // ya se cerró o hubo un nuevo inicio
  expirando = true;
  await cerrarSesion({ notificarServidor: false });
  notificar(oyentesExpiracion, 'expiración de sesión');
};
