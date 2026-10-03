// src/app/login.js
import { AntDesign, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';

// Necesario para completar la sesión en web/móvil
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = '459535616553-cvqcic2b2fl4s28em8rvmtt10gp35rn0.apps.googleusercontent.com';
const EXPO_OWNER = Constants.expoConfig?.owner || 'kungpao23';
const EXPO_SLUG = Constants.expoConfig?.slug || 'appMaru';
const GOOGLE_REDIRECT_URI = `https://auth.expo.io/@kungpao23/appMaru`;

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const completarInicioSesion = async (datos) => {
    await AsyncStorage.setItem('userToken', datos.token);
    await AsyncStorage.setItem('userId', datos.idUsuario.toString());

    if (datos.tieneGrupo) {
      router.replace('/(tabs)');
    } else {
      router.replace('/group-selection');
    }
  };

const iniciarSesionSocial = async (perfil) => {
    const respuesta = await fetch(`${API_URL}/api/auth/social-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(perfil)
    });
    const datos = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(datos.error || 'No se pudo iniciar sesión');
    }

    if (datos.nuevoUsuario) {
      // Si es nuevo, lo mandamos al flujo de completar perfil pasando su correo
      // Puedes pasar el correo por parámetros de ruta o guardarlo temporalmente
      router.push({
        pathname: '/signup',
        params: { emailPrellenado: datos.email, nombrePrellenado: datos.nombreSugerido }
      });
    } else {
      // Si ya existía, completa el inicio de sesión normal
      await completarInicioSesion(datos);
    }
    return datos;
  };

  const manejarLoginGoogle = async () => {
    try {
      const request = new AuthSession.AuthRequest({
        clientId: GOOGLE_CLIENT_ID,
        redirectUri: GOOGLE_REDIRECT_URI,
        responseType: AuthSession.ResponseType.Token,
        scopes: ['openid', 'profile', 'email'],
        usePKCE: false,
        extraParams: { prompt: 'select_account' }
      });
      const resultado = await request.promptAsync({
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth'
      });

      if (resultado.type !== 'success') return;

      const accessToken = resultado.authentication?.accessToken || resultado.params?.access_token;
      if (!accessToken) throw new Error('Google no devolvió un token de acceso.');

      await iniciarSesionSocial({ provider: 'google', accessToken });
    } catch (error) {
      alert(error.message || 'No se pudo iniciar sesión con Google.');
    }
  };

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
      const nombre = AppleAuthentication.formatFullName(credencial.fullName)?.trim()
        || credencial.email?.split('@')[0]
        || 'Usuario Apple';

      if (!credencial.identityToken) throw new Error('Apple no devolvió un token de identidad válido.');

      await iniciarSesionSocial({ provider: 'apple', identityToken: credencial.identityToken, nombre });
    } catch (error) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        const moduloNoDisponible = error.code === 'ERR_UNAVAILABLE'
          || error.message?.includes('expo-apple-authentication');
        alert(moduloNoDisponible
          ? 'Apple Sign-In no está disponible en esta sesión de Expo Go. Actualiza Expo Go o prueba con un development build de la app.'
          : error.message || 'No se pudo iniciar sesión con Apple.');
      }
    }
  };

  const manejarLoginTradicional = async () => {
    if (!email.trim() || !password.trim()) {
      alert('Por favor, completa todos los campos.');
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
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.scrollContent}>
      
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

      <TouchableOpacity style={estilos.botonPrimario} onPress={manejarLoginTradicional}>
        <Text style={estilos.textoBotonPrimario}>Iniciar sesión</Text>
      </TouchableOpacity>

      <Text style={estilos.textoSeparador}>O inicia sesión con</Text>
      {/*
      <TouchableOpacity style={estilos.botonSocial} onPress={() => manejarLoginSocial('Facebook')}>
        <FontAwesome5 name="facebook" size={20} color="#3b5998" style={estilos.iconoSocial} />
        <Text style={estilos.textoBotonSocial}>Continuar con Facebook</Text>
      </TouchableOpacity>
      */}
      {/* Botón Google directo */}
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
  textoRegistro: { color: '#0A3D4C', fontSize: 15, fontWeight: 'bold' }
});