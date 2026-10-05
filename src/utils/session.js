import AsyncStorage from '@react-native-async-storage/async-storage';

import { GoogleSignin } from '@react-native-google-signin/google-signin';

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
  await AsyncStorage.clear();
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    // Sin sesión de Google activa no hay nada que cerrar.
  }
};