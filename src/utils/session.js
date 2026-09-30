import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVES_SESION = ['userToken', 'userId', 'groupId'];

export const cerrarSesion = async () => {
  await AsyncStorage.multiRemove(CLAVES_SESION);
};