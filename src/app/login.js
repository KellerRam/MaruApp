// src/app/login.js
import { AntDesign, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';
import { registrarDispositivoPush } from '../utils/registroPush';

// Configuración inicial del SDK de Google Sign-In
GoogleSignin.configure({
  webClientId: '459535616553-cvqcic2b2fl4s28em8rvmtt10gp35rn0.apps.googleusercontent.com', // Reemplaza con tu Web Client ID de Google Cloud
  iosClientId: '459535616553-icgsebe4e8incmoj3q1na1mr6josf98e.apps.googleusercontent.com', // (Opcional si usas el plugin nativo, pero recomendado)
});

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const completarInicioSesion = async (datos) => {
    await AsyncStorage.setItem('userToken', datos.token);
    await AsyncStorage.setItem('userId', datos.idUsuario.toString());
    registrarDispositivoPush();

    if (datos.tieneGrupo) {
      router.replace('/(tabs)');
    } else {
      router.replace('/group-selection');
    }
  };

  const enviarLoginSocialAlBackend = async (perfilData) => {
    try {
      const respuesta = await fetch(`${API_URL}/api/auth/social-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(perfilData)
      });
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.error || 'No se pudo iniciar sesión');
      }

      await completarInicioSesion(datos);
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo completar el acceso social.');
    }
  };

  // Inicio de sesión estándar y nativo con Google
  const manejarLoginGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken || response.idToken;

      if (!idToken) throw new Error('Google no devolvió un token de identidad válido.');

      await enviarLoginSocialAlBackend({
        provider: 'google',
        idToken
      });
    } catch (error) {
      if (error.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('Error de Google', error.message || 'No se pudo iniciar sesión con Google.');
      }
    }
  };

  // Inicio de sesión estándar y nativo con Apple ID
  const manejarLoginApple = async () => {
    if (Platform.OS !== 'ios') {
      alert('El inicio de sesión con Apple solo está disponible en iOS.');
      return;
    }

    try {
      const credencial = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL
        ]
      });

      if (!credencial.identityToken) throw new Error('Apple no devolvió un token de identidad.');

      await enviarLoginSocialAlBackend({
        provider: 'apple',
        identityToken: credencial.identityToken
      });
    } catch (error) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Error de Apple', error.message || 'No se pudo iniciar sesión con Apple.');
      }
    }
  };

  const validarPassword = (pass) => {
    if (pass.length < 8 || pass.length > 14) {
      return 'La contraseña debe tener entre 8 y 14 caracteres.';
    }
    if (!/[A-Z]/.test(pass)) {
      return 'La contraseña debe contener al menos una letra mayúscula.';
    }
    return null;
  };

  const manejarLoginTradicional = async () => {
    if (!email.trim() || !password.trim()) {
      alert('Por favor, completa todos los campos.');
      return;
    }

    const errorPassword = validarPassword(password);
    if (errorPassword) {
      alert(errorPassword);
      return;
    }

    try {
      const respuesta = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const datos = await respuesta.json();
      
      if (respuesta.ok) {
        await completarInicioSesion(datos);
      } else {
        alert(datos.error || 'Error al iniciar sesión');
      }
    } catch (error) {
      alert('No se pudo conectar con el servidor');
    }
  };

  return (
    <KeyboardAvoidingView style={estilos.contenedor} behavior="padding">
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={estilos.contenedorLogo}>
        <Image 
          source={require('../../assets/images/logo.png')} 
          style={estilos.imagenLogo} 
          resizeMode="contain" 
        />
      </View>

      <View style={estilos.grupoInput}>
        <Text style={estilos.etiqueta}>Email</Text>
        <TextInput style={estilos.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      </View>

      <View style={estilos.grupoInput}>
        <Text style={estilos.etiqueta}>Contraseña</Text>
        <TextInput style={estilos.input} value={password} onChangeText={setPassword} secureTextEntry />
      </View>
{/*
      <TouchableOpacity onPress={() => router.push('/forgot-password')} style={estilos.contenedorOlvido}>
        <Text style={estilos.textoOlvido}>¿Olvidaste tu contraseña?</Text>
      </TouchableOpacity>
*/}
      <TouchableOpacity style={estilos.botonPrimario} onPress={manejarLoginTradicional}>
        <Text style={estilos.textoBotonPrimario}>Iniciar sesión</Text>
      </TouchableOpacity>

      <Text style={estilos.textoSeparador}>O inicia sesión con</Text>

      <TouchableOpacity style={estilos.botonSocial} onPress={manejarLoginGoogle}>
        <AntDesign name="google" size={20} color="#DB4437" style={estilos.iconoSocial} />
        <Text style={estilos.textoBotonSocial}>Continuar con Google</Text>
      </TouchableOpacity>

      <TouchableOpacity style={estilos.botonSocial} onPress={manejarLoginApple}>
        <Ionicons name="logo-apple" size={20} color="#000000" style={estilos.iconoSocial} />
        <Text style={estilos.textoBotonSocial}>Continuar con Apple</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/signup')} style={estilos.contenedorRegistro}>
        <Text style={estilos.textoRegistro}>Registrarse</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 24, justifyContent: 'center', minHeight: '100%' },
  contenedorLogo: { height: 120, justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  imagenLogo: { width: '80%', height: '100%' },
  grupoInput: { marginBottom: 16 },
  etiqueta: { fontSize: 14, color: '#333333', marginBottom: 6, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#CCCCCC', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, backgroundColor: '#FFF' },
  botonPrimario: { backgroundColor: '#60A5A3', borderRadius: 25, paddingVertical: 14, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  textoBotonPrimario: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  textoSeparador: { textAlign: 'center', color: '#777777', marginBottom: 20, fontSize: 13 },
  botonSocial: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#CCCCCC', borderRadius: 25, paddingVertical: 12, paddingHorizontal: 20, marginBottom: 12, backgroundColor: '#FFF' },
  iconoSocial: { marginRight: 12 },
  textoBotonSocial: { fontSize: 15, color: '#333333', fontWeight: '500' },
  contenedorRegistro: { alignItems: 'center', marginTop: 15 },
  contenedorOlvido: { alignSelf: 'flex-end', marginBottom: 8, paddingVertical: 6 },
  textoOlvido: { color: '#0A3D4C', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  textoRegistro: { color: '#0A3D4C', fontSize: 15, fontWeight: 'bold' }
});