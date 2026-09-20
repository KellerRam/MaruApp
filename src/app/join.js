import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../config/api';

export default function JoinGroupScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams();
  const [estado, setEstado] = useState('Procesando invitacion...');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unirse = async () => {
      const idUsuario = await AsyncStorage.getItem('userId');
      if (!idUsuario) {
        setEstado('Inicia sesion antes de aceptar la invitacion.');
        setCargando(false);
        return;
      }

      try {
        const respuesta = await fetch(`${API_URL}/api/groups/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: Array.isArray(token) ? token[0] : token, idUsuario: Number(idUsuario) }),
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) {
          setEstado(datos.error || 'No se pudo aceptar la invitacion.');
          return;
        }
        await AsyncStorage.setItem('groupId', datos.idGrupo.toString());
        setEstado('Te has unido al grupo correctamente.');
      } catch (error) {
        setEstado('No se pudo conectar con el servidor.');
      } finally {
        setCargando(false);
      }
    };

    unirse();
  }, [token]);

  return (
    <View style={estilos.contenedor}>
      {cargando ? <ActivityIndicator size="large" color="#60A5A3" /> : null}
      <Text style={estilos.mensaje}>{estado}</Text>
      {!cargando && (
        <TouchableOpacity style={estilos.boton} onPress={() => router.replace('/(tabs)')}>
          <Text style={estilos.textoBoton}>Continuar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FFFFFF' },
  mensaje: { color: '#333333', fontSize: 16, textAlign: 'center', marginTop: 18, marginBottom: 20 },
  boton: { backgroundColor: '#60A5A3', borderRadius: 25, paddingVertical: 14, paddingHorizontal: 36 },
  textoBoton: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
