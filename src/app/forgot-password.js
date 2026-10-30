// src/app/forgot-password.js
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../config/api';
import { apiFetch as fetch } from '../config/apiFetch';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);

  const validarPassword = (pass) => {
    if (pass.length < 8 || pass.length > 14) {
      return 'La contraseña debe tener entre 8 y 14 caracteres.';
    }
    if (!/[A-Z]/.test(pass)) {
      return 'La contraseña debe contener al menos una letra mayúscula.';
    }
    return null;
  };

  // Envía una petición al servidor y devuelve { ok, datos }; los errores de red se avisan aquí.
  const llamarServidor = async (ruta, cuerpo) => {
    setEnviando(true);
    try {
      const respuesta = await fetch(`${API_URL}/api/auth/password/${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const datos = await respuesta.json().catch(() => ({}));
      return { ok: respuesta.ok, datos };
    } catch (error) {
      Alert.alert('Sin conexión', 'No se pudo conectar con el servidor');
      return { ok: false, datos: null };
    } finally {
      setEnviando(false);
    }
  };

  const solicitarCodigo = async (reenviar = false) => {
    if (!email.trim()) {
      Alert.alert('Falta el correo', 'Ingresa el correo de tu cuenta.');
      return;
    }
    const { ok, datos } = await llamarServidor('request', { email: email.trim() });
    if (!datos) return;
    if (!ok) {
      Alert.alert('No se pudo enviar el código', datos.error || 'Intenta nuevamente');
      return;
    }
    if (reenviar === true) {
      Alert.alert('Código reenviado', 'Revisa tu correo electrónico.');
    } else {
      setCodigo('');
      setPaso(2);
    }
  };

  const verificarCodigo = async () => {
    if (codigo.trim().length !== 6) {
      Alert.alert('Código incompleto', 'Ingresa el código de 6 dígitos que enviamos a tu correo.');
      return;
    }
    const { ok, datos } = await llamarServidor('verify', { email: email.trim(), codigo: codigo.trim() });
    if (!datos) return;
    if (!ok) {
      Alert.alert('Código inválido', datos.error || 'Código incorrecto');
      return;
    }
    setPaso(3);
  };

  const guardarNuevaPassword = async () => {
    const errorPassword = validarPassword(password);
    if (errorPassword) {
      Alert.alert('Contraseña no válida', errorPassword);
      return;
    }
    if (password !== confirmacion) {
      Alert.alert('Las contraseñas no coinciden', 'Escribe la misma contraseña en ambos campos.');
      return;
    }
    const { ok, datos } = await llamarServidor('reset', { email: email.trim(), password });
    if (!datos) return;
    if (!ok) {
      Alert.alert('No se pudo actualizar', datos.error || 'Intenta nuevamente');
      return;
    }
    Alert.alert('Contraseña actualizada', 'Ya puedes iniciar sesión con tu nueva contraseña.', [
      { text: 'Aceptar', onPress: () => router.replace('/login') },
    ]);
  };

  return (
    <KeyboardAvoidingView style={estilos.contenedor} behavior="padding">
      <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.scrollContent} keyboardShouldPersistTaps="handled">

        <TouchableOpacity style={estilos.botonRegresar} onPress={() => router.replace('/login')}>
          <Text style={estilos.textoRegresar}>← Regresar</Text>
        </TouchableOpacity>

        <View style={estilos.contenedorLogo}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={estilos.imagenLogo}
            resizeMode="contain"
          />
        </View>

        {paso === 1 && (
          <>
            <Text style={estilos.tituloSeccion}>Recuperar contraseña</Text>
            <Text style={estilos.subtitulo}>Ingresa el correo de tu cuenta y te enviaremos un código de verificación.</Text>
            <View style={estilos.grupoInput}>
              <Text style={estilos.etiqueta}>Email</Text>
              <TextInput style={estilos.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>
            <TouchableOpacity style={estilos.botonPrimario} onPress={() => solicitarCodigo(false)} disabled={enviando}>
              <Text style={estilos.textoBotonPrimario}>{enviando ? 'Enviando...' : 'Enviar código de verificación'}</Text>
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
                value={codigo}
                onChangeText={setCodigo}
              />
            </View>
            <TouchableOpacity style={estilos.botonPrimario} onPress={verificarCodigo} disabled={enviando}>
              <Text style={estilos.textoBotonPrimario}>{enviando ? 'Verificando...' : 'Verificar código'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => solicitarCodigo(true)} style={{ alignItems: 'center', marginTop: 4 }}>
              <Text style={{ color: '#0A3D4C', fontWeight: '600' }}>Reenviar código</Text>
            </TouchableOpacity>
          </>
        )}

        {paso === 3 && (
          <>
            <Text style={estilos.tituloSeccion}>Nueva contraseña</Text>
            <Text style={estilos.subtitulo}>De 8 a 14 caracteres y al menos una mayúscula.</Text>
            <View style={estilos.grupoInput}>
              <Text style={estilos.etiqueta}>Nueva contraseña</Text>
              <TextInput style={estilos.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
            </View>
            <View style={estilos.grupoInput}>
              <Text style={estilos.etiqueta}>Confirmar contraseña</Text>
              <TextInput style={estilos.input} value={confirmacion} onChangeText={setConfirmacion} secureTextEntry autoCapitalize="none" />
            </View>
            <TouchableOpacity style={estilos.botonPrimario} onPress={guardarNuevaPassword} disabled={enviando}>
              <Text style={estilos.textoBotonPrimario}>{enviando ? 'Guardando...' : 'Guardar contraseña'}</Text>
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
  botonPrimario: { backgroundColor: '#60A5A3', borderRadius: 25, paddingVertical: 14, alignItems: 'center', marginTop: 10, marginBottom: 15 },
  textoBotonPrimario: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
