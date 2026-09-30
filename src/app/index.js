import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    let activo = true;

    const restaurarSesion = async () => {
      try {
        const [token, idUsuario] = await AsyncStorage.multiGet(['userToken', 'userId']);
        if (activo) {
          router.replace(token[1] && idUsuario[1] ? '/group-selection' : '/login');
        }
      } catch {
        if (activo) router.replace('/login');
      }
    };

    restaurarSesion();
    return () => { activo = false; };
  }, [router]);

  return (
    <View style={estilos.contenedor}>
      <ActivityIndicator size="large" color="#60A5A3" />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});