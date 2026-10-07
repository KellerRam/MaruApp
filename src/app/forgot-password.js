// src/app/forgot-password.js
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [cargando, setCargando] = useState(false);

  const llamar = async (ruta, cuerpo) => {
    const respuesta = await fetch(`${API_URL}/api/auth/${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.error || 'No se pudo completar la solicitud');
    return datos;
  };

  const ejecutar = async (accion) => {
    if (cargando) return;
    setCargando(true);
    try {
      await accion();
    } catch (error) {
      Alert.alert('Error', error.message === 'Network request failed' ? 'No se pudo conectar con el servidor' : error.message);
    } finally {
      setCargando(false);
    }
  };

  const enviarCodigo = (reenviar = false) => ejecutar(async () => {
    if (!email.trim()) throw new Error('Ingresa tu correo electrónico.');
    await llamar('forgot-password', { email: email.trim() });
    if (reenviar) Alert.alert('Código enviado', 'Si el correo está registrado, recibirás un nuevo código.');
    else setPaso(2);
  });

  const verificarCodigo = () => ejecutar(async () => {
    if (!/^\d{6}$/.test(codigo.trim())) throw new Error('Ingresa el código de 6 dígitos que enviamos a tu correo.');
    const datos = await llamar('verify-reset-code', { email: email.trim(), codigo: codigo.trim() });
    setResetToken(datos.resetToken);
    setPaso(3);
  });

  const guardarPassword = () => ejecutar(async () => {
    if (password.length < 8 || password.length > 14) throw new Error('La contraseña debe tener entre 8 y 14 caracteres.');
    if (!/[A-Z]/.test(password)) throw new Error('La contraseña debe contener al menos una letra mayúscula.');
    if (password !== confirmacion) throw new Error('Las contraseñas no coinciden.');
    await llamar('reset-password', { email: email.trim(), resetToken, password });
    Alert.alert('Contraseña actualizada', 'Ya puedes iniciar sesión con tu nueva contraseña.', [
      { text: 'OK', onPress: () => router.replace('/login') },
    ]);
  });

  return (
    <KeyboardAvoidingView style={estilos.contenedor} behavior="padding">
      <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={estilos.botonRegresar} onPress={() => router.replace('/login')}>
          <Text style={estilos.textoRegresar}>← Regresar</Text>
        </TouchableOpacity>

        <View style={estilos.contenedorLogo}>
          <Image source={require('../../assets/images/logo.png')} style={estilos.imagenLogo} resizeMode="contain" />
        </View>

        {paso === 1 && (
          <>
            <Text style={estilos.titulo}>Recuperar contraseña</Text>
            <Text style={estilos.subtitulo}>Ingresa tu correo y te enviaremos un código de verificación.</Text>
            <View style={estilos.grupoInput}>
              <Text style={estilos.etiqueta}>Email</Text>
              <TextInput style={estilos.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            </View>
            <TouchableOpacity style={estilos.botonPrimario} onPress={() => enviarCodigo(false)} disabled={cargando}>
              {cargando ? <ActivityIndicator color="#FFF" /> : <Text style={estilos.textoBotonPrimario}>Enviar código</Text>}
            </TouchableOpacity>
          </>
        )}

        {paso === 2 && (
          <>
            <Text style={estilos.titulo}>Verifica tu correo</Text>
            <Text style={estilos.subtitulo}>Ingresa el código de 6 dígitos que enviamos a {email.trim()}.</Text>
            <View style={estilos.grupoInput}>
              <Text style={estilos.etiqueta}>Código de 6 dígitos</Text>
              <TextInput
                style={[estilos.input, estilos.inputCodigo]}
                maxLength={6}
                keyboardType="number-pad"
                value={codigo}
                onChangeText={setCodigo}
              />
            </View>
            <TouchableOpacity style={estilos.botonPrimario} onPress={verificarCodigo} disabled={cargando}>
              {cargando ? <ActivityIndicator color="#FFF" /> : <Text style={estilos.textoBotonPrimario}>Verificar código</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => enviarCodigo(true)} disabled={cargando} style={estilos.enlace}>
              <Text style={estilos.textoEnlace}>Reenviar código</Text>
            </TouchableOpacity>
          </>
        )}

        {paso === 3 && (
          <>
            <Text style={estilos.titulo}>Nueva contraseña</Text>
            <Text style={estilos.subtitulo}>Entre 8 y 14 caracteres, con al menos una mayúscula.</Text>
            <View style={estilos.grupoInput}>
              <Text style={estilos.etiqueta}>Nueva contraseña</Text>
              <TextInput style={estilos.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
            </View>
            <View style={estilos.grupoInput}>
              <Text style={estilos.etiqueta}>Confirmar contraseña</Text>
              <TextInput style={estilos.input} value={confirmacion} onChangeText={setConfirmacion} secureTextEntry autoCapitalize="none" />
            </View>
            <TouchableOpacity style={estilos.botonPrimario} onPress={guardarPassword} disabled={cargando}>
              {cargando ? <ActivityIndicator color="#FFF" /> : <Text style={estilos.textoBotonPrimario}>Guardar contraseña</Text>}
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
  titulo: { fontSize: 20, fontWeight: 'bold', color: '#111', marginBottom: 10, textAlign: 'center' },
  subtitulo: { fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 20 },
  grupoInput: { marginBottom: 16 },
  etiqueta: { fontSize: 14, color: '#333333', marginBottom: 6, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#CCCCCC', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, backgroundColor: '#FFF' },
  inputCodigo: { textAlign: 'center', fontSize: 22, letterSpacing: 8 },
  botonPrimario: { backgroundColor: '#60A5A3', borderRadius: 25, paddingVertical: 14, alignItems: 'center', marginTop: 10, marginBottom: 15 },
  textoBotonPrimario: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  enlace: { alignItems: 'center', marginTop: 4 },
  textoEnlace: { color: '#0A3D4C', fontWeight: '600' },
});
