import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:3000`;
  }
  if (Platform.OS === 'android' && !Device.isDevice) {
    return 'http://10.0.2.2:3000';
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    return `http://${hostUri.split(':')[0]}:3000`;
  }
  return 'http://localhost:3000';
};

export const API_URL = getBaseUrl();