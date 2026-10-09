import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { leerSesion } from '../utils/almacenSesion';

// Mismo intervalo que usa el chat para refrescar mensajes.
const INTERVALO_MS = 5000;

// Vuelve a ejecutar `recargar` periódicamente y al volver a primer plano, solo con sesión activa.
export function useSincronizacion(recargar) {
  const recargarRef = useRef(recargar);
  recargarRef.current = recargar;

  useEffect(() => {
    let enCurso = false;
    let activo = true;

    const ejecutar = async () => {
      if (enCurso || !activo || AppState.currentState !== 'active') return;
      enCurso = true;
      try {
        const token = await leerSesion('userToken');
        if (token && activo) await recargarRef.current();
      } catch (error) {
        console.warn('No se pudo sincronizar:', error.message);
      } finally {
        enCurso = false;
      }
    };

    const intervalo = setInterval(ejecutar, INTERVALO_MS);
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') ejecutar();
    });

    return () => {
      activo = false;
      clearInterval(intervalo);
      suscripcion.remove();
    };
  }, []);
}
