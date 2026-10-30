// src/components/ui/CaritaAnimo.js
// Carita amarilla dibujada con vistas (se ve igual en Android e iOS) para el estado de ánimo.
// valor: 'mal' | 'regular' | 'bien' | 'muy_bien'. Sin onPress se muestra como ícono informativo.
import { StyleSheet, TouchableOpacity, View } from 'react-native';

const COLOR_CARITA = '#FFDE59';
const COLOR_RASGOS = '#3B2F1E';

export const NIVELES_ANIMO = ['mal', 'regular', 'bien', 'muy_bien'];

export default function CaritaAnimo({ valor, tamano = 56, seleccionada = false, onPress }) {
  const grosor = Math.max(2, Math.round(tamano * 0.05));
  const ojo = Math.max(3, Math.round(tamano * 0.1));
  const base = { position: 'absolute', alignSelf: 'center' };
  const boca = {
    mal: { ...base, top: '60%', width: tamano * 0.4, height: tamano * 0.2, borderTopWidth: grosor, borderTopLeftRadius: tamano, borderTopRightRadius: tamano, borderColor: COLOR_RASGOS },
    regular: { ...base, top: '66%', width: tamano * 0.4, height: grosor, backgroundColor: COLOR_RASGOS, borderRadius: grosor },
    bien: { ...base, top: '56%', width: tamano * 0.4, height: tamano * 0.2, borderBottomWidth: grosor, borderBottomLeftRadius: tamano, borderBottomRightRadius: tamano, borderColor: COLOR_RASGOS },
    muy_bien: { ...base, top: '56%', width: tamano * 0.46, height: tamano * 0.24, borderBottomLeftRadius: tamano, borderBottomRightRadius: tamano, backgroundColor: COLOR_RASGOS },
  }[valor];
  if (!boca) return null;

  const cara = (
    <View style={{ width: tamano, height: tamano, borderRadius: tamano / 2, backgroundColor: COLOR_CARITA }}>
      <View style={{ position: 'absolute', top: '34%', left: '29%', width: ojo, height: ojo * 1.3, borderRadius: ojo, backgroundColor: COLOR_RASGOS }} />
      <View style={{ position: 'absolute', top: '34%', right: '29%', width: ojo, height: ojo * 1.3, borderRadius: ojo, backgroundColor: COLOR_RASGOS }} />
      <View style={boca} />
    </View>
  );

  if (!onPress) return cara;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[estilos.marco, seleccionada && estilos.marcoActivo]}>
      {cara}
    </TouchableOpacity>
  );
}

const estilos = StyleSheet.create({
  marco: {
    padding: 4,
    marginHorizontal: 5,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  marcoActivo: {
    borderColor: '#008B8B',
  },
});
