import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const HORAS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTOS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export default function WheelTimePickerModal({
  visible,
  onClose,
  value = '12:00',
  onSelect,
  title = 'Seleccionar hora',
  minTime = null, // Formato "HH:MM" o Date
}) {
  const parsearMinTime = () => {
    if (!minTime) return null;
    if (minTime instanceof Date) {
      return {
        hora: minTime.getHours(),
        minuto: minTime.getMinutes(),
      };
    }
    if (typeof minTime === 'string' && minTime.includes(':')) {
      const [h, m] = minTime.split(':').map(Number);
      return { hora: isNaN(h) ? 0 : h, minuto: isNaN(m) ? 0 : m };
    }
    return null;
  };

  const limiteMinimo = parsearMinTime();

  const parsearValorInicial = () => {
    const partes = String(value || '12:00').split(':');
    let h = parseInt(partes[0], 10);
    let m = parseInt(partes[1], 10);
    if (isNaN(h) || h < 0 || h > 23) h = 12;
    if (isNaN(m) || m < 0 || m > 59) m = 0;

    // Si hay restricción de hora mínima y el valor inicial está en el pasado, ajustar al mínimo
    if (limiteMinimo) {
      if (h < limiteMinimo.hora) {
        h = limiteMinimo.hora;
        m = Math.max(m, limiteMinimo.minuto);
      } else if (h === limiteMinimo.hora && m < limiteMinimo.minuto) {
        m = limiteMinimo.minuto;
      }
    }

    return { hora: h, minuto: m };
  };

  const [horaSeleccionada, setHoraSeleccionada] = useState(12);
  const [minutoSeleccionado, setMinutoSeleccionado] = useState(0);

  const scrollHorasRef = useRef(null);
  const scrollMinutosRef = useRef(null);

  // Inicializar al abrir modal
  useEffect(() => {
    if (visible) {
      const { hora, minuto } = parsearValorInicial();
      setHoraSeleccionada(hora);
      setMinutoSeleccionado(minuto);

      setTimeout(() => {
        if (scrollHorasRef.current) {
          scrollHorasRef.current.scrollTo({ y: hora * ITEM_HEIGHT, animated: false });
        }
        if (scrollMinutosRef.current) {
          scrollMinutosRef.current.scrollTo({ y: minuto * ITEM_HEIGHT, animated: false });
        }
      }, 50);
    }
  }, [visible, value, minTime]);

  const esHoraDeshabilitada = (h) => {
    if (!limiteMinimo) return false;
    return h < limiteMinimo.hora;
  };

  const esMinutoDeshabilitado = (m, h) => {
    if (!limiteMinimo) return false;
    if (h < limiteMinimo.hora) return true;
    if (h === limiteMinimo.hora) return m < limiteMinimo.minuto;
    return false;
  };

  const manejarScrollFin = (tipo, offsetY) => {
    let index = Math.round(offsetY / ITEM_HEIGHT);
    if (tipo === 'hora') {
      if (index < 0) index = 0;
      if (index > 23) index = 23;

      if (esHoraDeshabilitada(index)) {
        index = limiteMinimo.hora;
        scrollHorasRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
      }

      setHoraSeleccionada(index);

      // Si al cambiar la hora, el minuto actual queda en el pasado para esa hora
      if (esMinutoDeshabilitado(minutoSeleccionado, index)) {
        const nuevoMin = limiteMinimo.minuto;
        setMinutoSeleccionado(nuevoMin);
        scrollMinutosRef.current?.scrollTo({ y: nuevoMin * ITEM_HEIGHT, animated: true });
      }
    } else {
      if (index < 0) index = 0;
      if (index > 59) index = 59;

      if (esMinutoDeshabilitado(index, horaSeleccionada)) {
        index = limiteMinimo.minuto;
        scrollMinutosRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
      }

      setMinutoSeleccionado(index);
    }
  };

  const seleccionarHoraDirecta = (h) => {
    if (esHoraDeshabilitada(h)) return;
    setHoraSeleccionada(h);
    scrollHorasRef.current?.scrollTo({ y: h * ITEM_HEIGHT, animated: true });

    if (esMinutoDeshabilitado(minutoSeleccionado, h)) {
      const nuevoMin = limiteMinimo.minuto;
      setMinutoSeleccionado(nuevoMin);
      scrollMinutosRef.current?.scrollTo({ y: nuevoMin * ITEM_HEIGHT, animated: true });
    }
  };

  const seleccionarMinutoDirecto = (m) => {
    if (esMinutoDeshabilitado(m, horaSeleccionada)) return;
    setMinutoSeleccionado(m);
    scrollMinutosRef.current?.scrollTo({ y: m * ITEM_HEIGHT, animated: true });
  };

  const confirmarSeleccion = () => {
    let hFinal = horaSeleccionada;
    let mFinal = minutoSeleccionado;

    if (limiteMinimo) {
      if (hFinal < limiteMinimo.hora) {
        hFinal = limiteMinimo.hora;
        mFinal = Math.max(mFinal, limiteMinimo.minuto);
      } else if (hFinal === limiteMinimo.hora && mFinal < limiteMinimo.minuto) {
        mFinal = limiteMinimo.minuto;
      }
    }

    const resultado = `${String(hFinal).padStart(2, '0')}:${String(mFinal).padStart(2, '0')}`;
    onSelect?.(resultado);
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={estilos.fondoModal}>
          <TouchableWithoutFeedback>
            <View style={estilos.tarjetaModal}>
              <View style={estilos.cabecera}>
                <Text style={estilos.titulo}>{title}</Text>
                <Text style={estilos.subtitulo}>Formato de 24 horas</Text>
              </View>

              <View style={estilos.contenedorRuedas}>
                {/* Indicador de selección central compartido */}
                <View style={estilos.indicadorSeleccion} pointerEvents="none" />

                {/* Rueda 1: Horas */}
                <View style={estilos.columnaRueda}>
                  <Text style={estilos.etiquetaColumna}>HORA</Text>
                  <ScrollView
                    ref={scrollHorasRef}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_HEIGHT}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(e) => manejarScrollFin('hora', e.nativeEvent.contentOffset.y)}
                    contentContainerStyle={estilos.scrollContent}
                  >
                    {HORAS_24.map((hStr, idx) => {
                      const deshabilitado = esHoraDeshabilitada(idx);
                      const activo = idx === horaSeleccionada;
                      return (
                        <TouchableOpacity
                          key={`h-${hStr}`}
                          style={estilos.itemRueda}
                          disabled={deshabilitado}
                          onPress={() => seleccionarHoraDirecta(idx)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              estilos.textoItem,
                              activo && estilos.textoItemActivo,
                              deshabilitado && estilos.textoItemDeshabilitado,
                            ]}
                          >
                            {hStr}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Separador ":" */}
                <View style={estilos.separador}>
                  <Text style={estilos.textoSeparador}>:</Text>
                </View>

                {/* Rueda 2: Minutos */}
                <View style={estilos.columnaRueda}>
                  <Text style={estilos.etiquetaColumna}>MINUTOS</Text>
                  <ScrollView
                    ref={scrollMinutosRef}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_HEIGHT}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(e) => manejarScrollFin('minuto', e.nativeEvent.contentOffset.y)}
                    contentContainerStyle={estilos.scrollContent}
                  >
                    {MINUTOS.map((mStr, idx) => {
                      const deshabilitado = esMinutoDeshabilitado(idx, horaSeleccionada);
                      const activo = idx === minutoSeleccionado;
                      return (
                        <TouchableOpacity
                          key={`m-${mStr}`}
                          style={estilos.itemRueda}
                          disabled={deshabilitado}
                          onPress={() => seleccionarMinutoDirecto(idx)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              estilos.textoItem,
                              activo && estilos.textoItemActivo,
                              deshabilitado && estilos.textoItemDeshabilitado,
                            ]}
                          >
                            {mStr}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>

              {limiteMinimo && (
                <Text style={estilos.avisoRestriccion}>
                  * Horas anteriores no disponibles para programar hoy
                </Text>
              )}

              <View style={estilos.filaBotones}>
                <TouchableOpacity style={estilos.botonCancelar} onPress={onClose} activeOpacity={0.7}>
                  <Text style={estilos.textoBotonCancelar}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={estilos.botonAceptar} onPress={confirmarSeleccion} activeOpacity={0.7}>
                  <Text style={estilos.textoBotonAceptar}>Aceptar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tarjetaModal: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  cabecera: {
    alignItems: 'center',
    marginBottom: 16,
  },
  titulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111111',
  },
  subtitulo: {
    fontSize: 12,
    color: '#60A5A3',
    fontWeight: '600',
    marginTop: 2,
  },
  contenedorRuedas: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: WHEEL_HEIGHT,
    position: 'relative',
    width: '100%',
  },
  indicadorSeleccion: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 20,
    right: 20,
    height: ITEM_HEIGHT,
    backgroundColor: '#EAF5F4',
    borderRadius: 10,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#60A5A3',
    zIndex: 1,
  },
  columnaRueda: {
    flex: 1,
    height: WHEEL_HEIGHT,
    alignItems: 'center',
    zIndex: 2,
  },
  etiquetaColumna: {
    position: 'absolute',
    top: -16,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#7E9A98',
    letterSpacing: 1,
  },
  scrollContent: {
    paddingVertical: ITEM_HEIGHT * 2,
    alignItems: 'center',
  },
  itemRueda: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  textoItem: {
    fontSize: 20,
    color: '#888888',
    fontWeight: '500',
  },
  textoItemActivo: {
    fontSize: 24,
    color: '#0A3D4C',
    fontWeight: 'bold',
  },
  textoItemDeshabilitado: {
    color: '#D0D7D6',
    opacity: 0.4,
  },
  separador: {
    width: 28,
    height: WHEEL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  textoSeparador: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0A3D4C',
  },
  avisoRestriccion: {
    fontSize: 11,
    color: '#D32F2F',
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
  },
  filaBotones: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
    gap: 12,
  },
  botonCancelar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F0F4F4',
    alignItems: 'center',
  },
  textoBotonCancelar: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666666',
  },
  botonAceptar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#3B7A8C',
    alignItems: 'center',
  },
  textoBotonAceptar: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
