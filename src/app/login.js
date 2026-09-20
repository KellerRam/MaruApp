// src/app/login.js
import { AntDesign, FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../config/api';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const manejarLogin = async () => {
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
        await AsyncStorage.setItem('userToken', datos.token);
        await AsyncStorage.setItem('userId', datos.idUsuario.toString());

        if (datos.tieneGrupo) {
          router.replace('/(tabs)');
        } else {
          router.replace('/group-selection');
        }
      } else {
        alert(datos.error || 'Error al iniciar sesión');
      }
    } catch (error) {
      alert('No se pudo conectar con el servidor');
    }
  };

  const manejarLoginSocial = (proveedor) => {
    alert(`La autenticación con ${proveedor} todavía no está configurada.`);
  };

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.scrollContent}>
      <View style={estilos.contenedorLogo}>
        <Text style={estilos.textoLogo}>LOGO</Text>
      </View>

      <View style={estilos.grupoInput}>
        <Text style={estilos.etiqueta}>Email</Text>
        <TextInput style={estilos.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      </View>

      <View style={estilos.grupoInput}>
        <Text style={estilos.etiqueta}>Contraseña</Text>
        <TextInput style={estilos.input} value={password} onChangeText={setPassword} secureTextEntry />
      </View>

      <TouchableOpacity style={estilos.botonPrimario} onPress={manejarLogin}>
        <Text style={estilos.textoBotonPrimario}>Iniciar sesión</Text>
      </TouchableOpacity>

      <Text style={estilos.textoSeparador}>O inicia sesión con</Text>

      <TouchableOpacity style={estilos.botonSocial} onPress={() => manejarLoginSocial('Facebook')}>
        <FontAwesome5 name="facebook" size={20} color="#3b5998" style={estilos.iconoSocial} />
        <Text style={estilos.textoBotonSocial}>Continuar con Facebook</Text>
      </TouchableOpacity>

      <TouchableOpacity style={estilos.botonSocial} onPress={() => manejarLoginSocial('Google')}>
        <AntDesign name="google" size={20} color="#DB4437" style={estilos.iconoSocial} />
        <Text style={estilos.textoBotonSocial}>Continuar con Google</Text>
      </TouchableOpacity>

      <TouchableOpacity style={estilos.botonSocial} onPress={() => manejarLoginSocial('Apple')}>
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
  contenedorLogo: { height: 100, borderWidth: 2, borderColor: '#A8D8D0', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 30, backgroundColor: '#F9FBFB' },
  textoLogo: { fontSize: 36, fontWeight: 'bold', color: '#60A5A3', letterSpacing: 4 },
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