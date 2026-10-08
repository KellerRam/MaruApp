import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

const TOTAL_PESTANAS = 5;

// pestana: índice de la pestaña inferior señalada (null = botón de menú superior).
const PASOS = [
  { pestana: 0, ruta: '/', titulo: 'Inicio', texto: 'Aquí ves el resumen del día: próxima toma de medicamento, turno de cuidado y actividades. Desde aquí también registras síntomas y el estado de ánimo.' },
  { pestana: 1, titulo: 'Chat', texto: 'Habla en tiempo real con los demás miembros del grupo. Recibirás una notificación cuando lleguen mensajes.' },
  { pestana: 2, titulo: 'Calendario', texto: 'Consulta y programa citas, horarios de cuidado y medicamentos del paciente.' },
  { pestana: 3, ruta: '/GroupScreen', titulo: 'Grupo: agregar miembros', texto: 'Toca "+ agregar miembro" para invitar a alguien por enlace o QR. Con el menú de cada miembro (⋮) puedes cambiar su rol entre paciente y cuidador.' },
  { pestana: 3, ruta: '/GroupScreen', titulo: 'Paciente sin celular', texto: 'La opción "Agregar paciente que no tiene celular" te permite registrar y administrar en el grupo a un paciente que no posee un dispositivo móvil propio. Su perfil no necesita correo y siempre permanece como paciente.' },
  { pestana: 4, titulo: 'Finanzas', texto: 'Registra ingresos y gastos del cuidado, con comprobantes, para llevar las cuentas del grupo.' },
  { pestana: null, titulo: 'Menú', texto: 'Con este botón abres el menú lateral: tu perfil, notificaciones, historial de síntomas y cerrar sesión.' },
];

export default function TutorialTour() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [clave, setClave] = useState(null);
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const idUsuario = await AsyncStorage.getItem('userId');
        if (!idUsuario) return;
        const claveUsuario = `tutorialVisto_${idUsuario}`;
        if (!(await AsyncStorage.getItem(claveUsuario)) && activo) setClave(claveUsuario);
      } catch {
        // Sin acceso al storage no se muestra el tutorial.
      }
    })();
    return () => { activo = false; };
  }, []);

  if (!clave) return null;

  const cerrar = async () => {
    const claveActual = clave;
    setClave(null);
    router.navigate('/');
    await AsyncStorage.setItem(claveActual, '1').catch(() => {});
  };

  const ir = (nuevo) => {
    if (nuevo >= PASOS.length) { cerrar(); return; }
    const destino = PASOS[nuevo].ruta;
    if (destino) router.navigate(destino);
    setPaso(nuevo);
  };

  const actual = PASOS[paso];
  const esUltimo = paso === PASOS.length - 1;
  const enMenu = actual.pestana === null;
  const flechaX = enMenu ? 36 : ((actual.pestana + 0.5) / TOTAL_PESTANAS) * width - 8;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={cerrar}>
      <View style={estilos.fondo}>
        <View style={[estilos.zona, enMenu ? estilos.zonaArriba : estilos.zonaAbajo]}>
          {enMenu && <View style={[estilos.flechaArriba, { left: flechaX }]} />}
          <View style={estilos.globo}>
            <Text style={estilos.titulo}>{actual.titulo}</Text>
            <Text style={estilos.texto}>{actual.texto}</Text>
            <View style={estilos.pie}>
              <TouchableOpacity onPress={cerrar}><Text style={estilos.saltar}>Saltar tutorial</Text></TouchableOpacity>
              <Text style={estilos.contador}>{paso + 1}/{PASOS.length}</Text>
              <TouchableOpacity style={estilos.siguiente} onPress={() => ir(paso + 1)}>
                <Text style={estilos.textoSiguiente}>{esUltimo ? 'Finalizar' : 'Siguiente'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {!enMenu && <View style={[estilos.flechaAbajo, { left: flechaX }]} />}
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  zona: { position: 'absolute', left: 16, right: 16 },
  zonaAbajo: { bottom: 84 },
  zonaArriba: { top: 90 },
  globo: { backgroundColor: '#FFF', borderRadius: 16, padding: 18 },
  titulo: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 6 },
  texto: { fontSize: 14, color: '#444', lineHeight: 20 },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  saltar: { color: '#777', fontSize: 13, textDecorationLine: 'underline' },
  contador: { color: '#999', fontSize: 12 },
  siguiente: { backgroundColor: '#60A5A3', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  textoSiguiente: { color: '#FFF', fontWeight: '600' },
  flechaAbajo: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFF' },
  flechaArriba: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderBottomWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#FFF' },
});
