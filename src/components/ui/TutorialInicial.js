// src/components/ui/TutorialInicial.js
// Tutorial del primer inicio de sesión: burbujas cortas que señalan cada módulo de la app.
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TOTAL_PESTANAS = 5; // Inicio, Chat, Calendario, Grupo, Finanzas (mismo orden que la barra inferior)
const ALTO_BARRA_PESTANAS = 70;

const PASOS = [
  {
    icono: 'home',
    titulo: 'Inicio',
    texto: 'Consulta la próxima toma, el próximo turno de cuidado y el próximo evento. Desde aquí puedes activar la emergencia, registrar síntomas y pedir al paciente que confirme su bienestar.',
    ancla: { pestana: 0 },
  },
  {
    icono: 'message-circle',
    titulo: 'Chat',
    texto: 'Habla con todo el grupo: mensajes, imágenes, documentos y audios. Las alertas importantes también quedan registradas aquí.',
    ancla: { pestana: 1 },
  },
  {
    icono: 'calendar',
    titulo: 'Calendario',
    texto: 'Registra eventos, medicamentos y turnos de cuidado. La app te recordará cada uno antes de que ocurra.',
    ancla: { pestana: 2 },
  },
  {
    icono: 'users',
    titulo: 'Grupo',
    texto: 'Mira a los miembros, invita a más personas por enlace o QR y asigna el rol de paciente o cuidador.',
    ancla: { pestana: 3 },
  },
  {
    icono: 'file-text',
    titulo: 'Finanzas',
    texto: 'Lleva el registro de los gastos del cuidado para que todo el grupo los consulte en un solo lugar.',
    ancla: { pestana: 4 },
  },
  {
    icono: 'list',
    titulo: 'Menú y notificaciones',
    texto: 'Con este botón abres el menú: ahí ajustas tus notificaciones, ves el historial de síntomas, tu perfil y cierras sesión.',
    ancla: { menu: true },
  },
];

export default function TutorialInicial({ visible, onClose }) {
  const [indice, setIndice] = useState(0);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const paso = PASOS[indice];
  const esUltimo = indice === PASOS.length - 1;

  const margenLateral = 16;
  const anchoFlecha = 20;
  const centroFlecha = paso.ancla.menu
    ? 16 + 20 // botón de menú: margen izquierdo 16 + radio 20
    : (width / TOTAL_PESTANAS) * (paso.ancla.pestana + 0.5);
  const izquierdaFlecha = Math.min(
    Math.max(centroFlecha - margenLateral - anchoFlecha / 2, 12),
    width - margenLateral * 2 - anchoFlecha - 12
  );
  const posicionVertical = paso.ancla.menu
    ? { top: insets.top + 62 }
    : { bottom: insets.bottom + ALTO_BARRA_PESTANAS + 6 };

  const cerrar = () => {
    setIndice(0);
    onClose();
  };

  const avanzar = () => {
    if (esUltimo) cerrar();
    else setIndice(indice + 1);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cerrar}>
      <View style={estilos.fondo}>
        <View style={[estilos.contenedorBurbuja, posicionVertical, { left: margenLateral, right: margenLateral }]}>
          {paso.ancla.menu && <View style={[estilos.flechaArriba, { left: izquierdaFlecha }]} />}

          <View style={estilos.burbuja}>
            <View style={estilos.cabecera}>
              <View style={estilos.circuloIcono}>
                <Feather name={paso.icono} size={20} color="#FFFFFF" />
              </View>
              <Text style={estilos.titulo}>{paso.titulo}</Text>
            </View>

            <Text style={estilos.texto}>{paso.texto}</Text>

            <View style={estilos.puntos}>
              {PASOS.map((_, i) => (
                <View key={i} style={[estilos.punto, i === indice && estilos.puntoActivo]} />
              ))}
            </View>

            <View style={estilos.filaBotones}>
              <TouchableOpacity onPress={cerrar} style={estilos.botonOmitir} disabled={esUltimo}>
                <Text style={estilos.textoOmitir}>{esUltimo ? '' : 'Omitir'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={avanzar} style={estilos.botonSiguiente}>
                <Text style={estilos.textoSiguiente}>{esUltimo ? 'Entendido' : 'Siguiente'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {!paso.ancla.menu && <View style={[estilos.flechaAbajo, { left: izquierdaFlecha }]} />}
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  contenedorBurbuja: { position: 'absolute' },
  burbuja: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18 },
  cabecera: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  circuloIcono: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#60A5A3', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  titulo: { fontSize: 18, fontWeight: 'bold', color: '#0A3D4C', flex: 1 },
  texto: { fontSize: 14, color: '#333333', lineHeight: 20, marginBottom: 14 },
  puntos: { flexDirection: 'row', justifyContent: 'center', marginBottom: 14 },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C8E8E2', marginHorizontal: 3 },
  puntoActivo: { backgroundColor: '#60A5A3', width: 18 },
  filaBotones: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  botonOmitir: { paddingVertical: 10, paddingRight: 16, minWidth: 80 },
  textoOmitir: { color: '#777777', fontSize: 14, fontWeight: '600' },
  botonSiguiente: { backgroundColor: '#60A5A3', borderRadius: 25, paddingVertical: 10, paddingHorizontal: 24 },
  textoSiguiente: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  flechaAbajo: {
    position: 'absolute',
    bottom: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  flechaArriba: {
    position: 'absolute',
    top: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
  },
});
