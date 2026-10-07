// src/app/signup.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';
import { registrarDispositivoPush } from '../utils/registroPush';

export default function SignupScreen() {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigoUnico, setCodigoUnico] = useState('');

  const [nombre, setNombre] = useState('');
  const [genero, setGenero] = useState('Masculino');
  const [dia, setDia] = useState('');
  const [mes, setMes] = useState('');
  const [anio, setAnio] = useState('');

  const validarPassword = (pass) => {
    if (pass.length < 8 || pass.length > 14) {
      return 'La contraseña debe tener entre 8 y 14 caracteres.';
    }
    if (!/[A-Z]/.test(pass)) {
      return 'La contraseña debe contener al menos una letra mayúscula.';
    }
    return null;
  };

  const solicitarCodigo = async (reenviar = false) => {
    if (!email.trim() || !password.trim()) {
      alert('Por favor, ingresa correo y contraseña.');
      return;
    }
    if (reenviar !== true) {
      const errorPassword = validarPassword(password);
      if (errorPassword) {
        alert(errorPassword);
        return;
      }
    }

    try {
      const endpoint = reenviar === true ? 'request-code' : 'signup';
      console.log("Enviando petición a:", `${API_URL}/api/auth/${endpoint}`);
      
      const respuesta = await fetch(`${API_URL}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const datos = await respuesta.json();
      console.log("STATUS servidor (Paso 1):", respuesta.status);
      console.log("DATOS servidor (Paso 1):", datos);

      if (respuesta.ok) {
        if (reenviar !== true) {
          setPaso(2); // <--- Esto es lo que cambia la pantalla al Paso 2
        } else {
          alert('Código reenviado con éxito');
        }
      } else {
        alert(datos.error || 'Error al registrarse');
      }
    } catch (error) {
      console.log("ERROR DE RED (Paso 1):", error);
      alert('No se pudo conectar con el servidor');
    }
  };

  const verificarCodigo = async () => {
    if (!codigoUnico.trim()) {
      alert('Ingresa el código de verificación que enviamos a tu correo.');
      return;
    }

    try {
      const respuesta = await fetch(`${API_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo: codigoUnico })
      });
      
      const datos = await respuesta.json();
      console.log("STATUS:", respuesta.status);
      console.log("DATOS:", datos);

      if (respuesta.ok) {
        setCodigoUnico('');
        setPaso(3);
      } else {
        alert(datos.error || 'Código incorrecto');
      }
    } catch (error) {
      console.log("ERROR DE RED:", error);
      alert('No se pudo conectar con el servidor');
    }
  };

  const guardarPerfilFinal = async () => {
    if (!nombre.trim() || !dia.trim() || !mes.trim() || !anio.trim()) {
      alert('Por favor, completa todos los datos de tu perfil.');
      return;
    }

    try {
      const fechaNacimiento = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      const respuesta = await fetch(`${API_URL}/api/auth/complete-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nombre, genero, fechaNacimiento })
      });
      const datos = await respuesta.json();
      if (respuesta.ok) {
        await AsyncStorage.setItem('userToken', datos.token);
        await AsyncStorage.setItem('userId', datos.idUsuario.toString());
        registrarDispositivoPush();
        router.push('/group-selection');
      } else {
        alert(datos.error || 'Error al guardar perfil');
      }
    } catch (error) {
      alert('No se pudo conectar con el servidor');
    }
  };

  return (
    <KeyboardAvoidingView style={estilos.contenedor} behavior="padding">
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.scrollContent} keyboardShouldPersistTaps="handled">
      
      {/* Botón superior para regresar al login */}
      <TouchableOpacity style={estilos.botonRegresar} onPress={() => router.replace('/login')}>
        <Text style={estilos.textoRegresar}>← Regresar</Text>
      </TouchableOpacity>

      {/* Contenedor del Logo con Imagen */}
      <View style={estilos.contenedorLogo}>
        <Image 
          source={require('../../assets/images/logo.png')} 
          style={estilos.imagenLogo} 
          resizeMode="contain" 
        />
      </View>

      {paso === 1 && (
        <>
          <Text style={estilos.tituloSeccion}>Crear una cuenta</Text>
          <View style={estilos.grupoInput}>
            <Text style={estilos.etiqueta}>Email</Text>
            <TextInput style={estilos.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View style={estilos.grupoInput}>
            <Text style={estilos.etiqueta}>Contraseña</Text>
            <TextInput style={estilos.input} value={password} onChangeText={setPassword} secureTextEntry />
          </View>
          <TouchableOpacity style={estilos.botonPrimario} onPress={solicitarCodigo}>
            <Text style={estilos.textoBotonPrimario}>Enviar código de verificación</Text>
          </TouchableOpacity>
        </>
      )}

      {paso === 2 && (
        <>
          <Text style={estilos.tituloSeccion}>Verifica tu correo</Text>
          <Text style={estilos.subtitulo}>Ingresa el código que enviamos a tu correo.</Text>
          <View style={estilos.grupoInput}>
            <Text style={estilos.etiqueta}>Código de 6 dígitos</Text>
            <TextInput 
              style={[estilos.input, { textAlign: 'center', fontSize: 22, letterSpacing: 8 }]} 
              maxLength={6}
              keyboardType="number-pad" 
              value={codigoUnico} 
              onChangeText={setCodigoUnico} 
            />
          </View>
          <TouchableOpacity style={estilos.botonPrimario} onPress={verificarCodigo}>
            <Text style={estilos.textoBotonPrimario}>Verificar código</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => solicitarCodigo(true)} style={{ alignItems: 'center', marginTop: 4 }}>
            <Text style={{ color: '#0A3D4C', fontWeight: '600' }}>Reenviar código</Text>
          </TouchableOpacity>
        </>
      )}

      {paso === 3 && (
        <>
          <Text style={estilos.tituloSeccion}>Completa tus datos</Text>
          <View style={estilos.grupoInput}>
            <Text style={estilos.etiqueta}>Nombre completo</Text>
            <TextInput style={estilos.input} value={nombre} onChangeText={setNombre} />
          </View>
          <View style={estilos.grupoInput}>
            <Text style={estilos.etiqueta}>Género</Text>
            <View style={estilos.filaGenero}>
              {['Masculino', 'Femenino', 'Otro'].map((g) => (
                <TouchableOpacity key={g} onPress={() => setGenero(g)} style={estilos.opcionGenero}>
                  <View style={[estilos.circuloRadio, genero === g && estilos.circuloSeleccionado]}>
                    {genero === g && <View style={estilos.puntoInterno} />}
                  </View>
                  <Text>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={estilos.grupoInput}>
            <Text style={estilos.etiqueta}>Fecha de nacimiento</Text>
            <View style={estilos.contenedorFechas}>
              <TextInput style={estilos.inputFecha} placeholder="Día" placeholderTextColor="#48d9d9" maxLength={2} keyboardType="number-pad" value={dia} onChangeText={setDia} />
              <TextInput style={estilos.inputFecha} placeholder="Mes" placeholderTextColor="#48d9d9" maxLength={2} keyboardType="number-pad" value={mes} onChangeText={setMes} />
              <TextInput style={estilos.inputFecha} placeholder="Año" placeholderTextColor="#48d9d9" maxLength={4} keyboardType="number-pad" value={anio} onChangeText={setAnio} />
            </View>
          </View>
          <TouchableOpacity style={estilos.botonPrimario} onPress={guardarPerfilFinal}>
            <Text style={estilos.textoBotonPrimario}>Guardar y finalizar</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 24, justifyContent: 'center', minHeight: '100%' },
  
  botonRegresar: { marginBottom: 15 },
  textoRegresar: { color: '#0A3D4C', fontSize: 18, fontWeight: '600' },

  contenedorLogo: { height: 110, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  imagenLogo: { width: '75%', height: '100%' },

  tituloSeccion: { fontSize: 20, fontWeight: 'bold', color: '#111', marginBottom: 15, textAlign: 'center' },
  subtitulo: { fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 20 },
  grupoInput: { marginBottom: 16 },
  etiqueta: { fontSize: 14, color: '#333333', marginBottom: 6, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#CCCCCC', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, backgroundColor: '#FFF' },
  filaGenero: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 8 },
  opcionGenero: { flexDirection: 'row', alignItems: 'center' },
  circuloRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#008B8B', justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  circuloSeleccionado: { borderColor: '#008B8B' },
  puntoInterno: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#008B8B' },
  contenedorFechas: { flexDirection: 'row', justifyContent: 'space-between' },
  inputFecha: { width: '30%', borderWidth: 1, borderColor: '#CCCCCC', borderRadius: 12, paddingVertical: 10, textAlign: 'center', fontSize: 16, backgroundColor: '#FFF' },
  botonPrimario: { backgroundColor: '#60A5A3', borderRadius: 25, paddingVertical: 14, alignItems: 'center', marginTop: 10, marginBottom: 15 },
  textoBotonPrimario: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});