// src/app/login.js
import { AntDesign, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';

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

  // Botón Google adaptado para pedir el correo de forma limpia y directa sin romper TestFlight
  const manejarLoginGoogle = () => {
    Alert.prompt(
      'Continuar con Google',
      'Ingresa tu correo asociado a Google:',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: (correoInput) => {
            if (!correoInput || !correoInput.includes('@')) {
              alert('Correo inválido');
              return;
            }
            enviarLoginSocialAlBackend({
              provider: 'google',
              email: correoInput.toLowerCase().trim(),
              nombre: correoInput.split('@')[0]
            });
          }
        }
      ],
      'plain-text'
    );
  };

  // Botón Apple ID usando directamente el SDK nativo de Apple
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

      const emailApple = credencial.email || `${credencial.user}@privateray.appleid.com`;
      const nombreApple = AppleAuthentication.formatFullName(credencial.fullName)?.trim() || 'Usuario Apple';

      await enviarLoginSocialAlBackend({
        provider: 'apple',
        email: emailApple,
        nombre: nombreApple
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