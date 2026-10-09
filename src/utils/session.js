import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { conTiempoLimite, limpiarSesion } from './almacenSesion';

const oyentes = new Set();

// Permite que componentes montados descarten su estado en memoria al cerrar sesión.
export const alCerrarSesion = (oyente) => {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
};

export const cerrarSesion = async () => {
  oyentes.forEach((oyente) => {
    try {
      oyente();
    } catch (error) {
      console.warn('Error en oyente de cierre de sesión:', error.message);
    }
  });
  await limpiarSesion();
  try {
    await conTiempoLimite(GoogleSignin.signOut(), 4000, 'cerrar sesión de Google');
  } catch (error) {
    // Sin sesión de Google activa no hay nada que cerrar.
  }
};