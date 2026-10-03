// src/components/ui/FormPickerInput.js
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import {
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function FormPickerInput({
  pickerType = 'time', // 'time' | 'date'
  modalTitle = 'Seleccionar',
  style,
  value,
  onChangeText,
  placeholder,
  minTime,
  minDate,
}) {
  const [modalVisible, setModalVisible] = useState(false);

  // =========================
  // HORA
  // =========================
  const [horaSeleccionada, setHoraSeleccionada] = useState(
    value ? value.substring(0, 2) : '08'
  );

  const [minutoSeleccionado, setMinutoSeleccionado] = useState(
    value ? value.substring(3, 5) : '00'
  );

  // =========================
  // FECHA
  // =========================
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    value ? parseFecha(value) : new Date()
  );

  const [mostrarDatePicker, setMostrarDatePicker] = useState(false);

  // Sincronizar si el valor viene desde el formulario padre
  useEffect(() => {
    if (pickerType === 'time') {
      if (value) {
        setHoraSeleccionada(value.substring(0, 2));
        setMinutoSeleccionado(value.substring(3, 5));
      }
    }

    if (pickerType === 'date') {
      if (value) {
        const fecha = parseFecha(value);

        if (!isNaN(fecha.getTime())) {
          setFechaSeleccionada(fecha);
        }
      }
    }
  }, [value, pickerType]);

  // =========================
  // HORAS Y MINUTOS
  // =========================

  const horas = Array.from(
    { length: 24 },
    (_, i) => String(i).padStart(2, '0')
  );

  const minutos = Array.from(
    { length: 12 },
    (_, i) => String(i * 5).padStart(2, '0')
  );

  // =========================
  // CONFIRMAR
  // =========================

  const confirmarSeleccion = () => {
    if (pickerType === 'time') {
      const valorFinal = `${horaSeleccionada}:${minutoSeleccionado}`;

      onChangeText(valorFinal);
      setModalVisible(false);
      return;
    }

    if (pickerType === 'date') {
      const fechaFormateada = formatearFecha(fechaSeleccionada);

      onChangeText(fechaFormateada);
      setModalVisible(false);
    }
  };

  // =========================
  // CAMBIO DE FECHA
  // =========================

  const handleDateChange = (event, selectedDate) => {
    // Android puede enviar "dismissed" cuando el usuario cancela
    if (event?.type === 'dismissed') {
      setMostrarDatePicker(false);
      return;
    }

    if (selectedDate) {
      setFechaSeleccionada(selectedDate);
    }

    // En Android el calendario se cierra después de seleccionar
    if (Platform.OS === 'android') {
      setMostrarDatePicker(false);
    }
  };

  // =========================
  // RENDER
  // =========================

  return (
    <View style={styles.contenedorPrincipal}>
      {/* Campo */}
      <TouchableOpacity
        style={[styles.inputContenedor, style]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <TextInput
          style={styles.textoInputOculto}
          value={value}
          placeholder={placeholder}
          placeholderTextColor="#48d9d9"
          editable={false}
          pointerEvents="none"
        />

        <Text style={[styles.textoVisible, !value && styles.placeholder]}>
          {value || placeholder}
        </Text>

        <Feather
          name={pickerType === 'time' ? 'clock' : 'calendar'}
          size={18}
          color="#555"
        />
      </TouchableOpacity>

      {/* MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.fondoModal}>
          <View style={styles.tarjetaModal}>
            <Text style={styles.tituloModal}>
              {modalTitle}
            </Text>

            {pickerType === 'time' && (
              <Text style={styles.subtituloModal}>
                Formato de 24 horas
              </Text>
            )}

            {pickerType === 'time' && (
              <View style={styles.selectorRuedasContenedor}>
                {/* HORAS */}
                <View style={styles.columnaRueda}>
                  <Text style={styles.labelColumna}>
                    HORA
                  </Text>

                  <FlatList
                    data={horas}
                    keyExtractor={(item) => `h-${item}`}
                    showsVerticalScrollIndicator={false}
                    getItemLayout={(data, index) => ({
                      length: 40,
                      offset: 40 * index,
                      index,
                    })}
                    contentContainerStyle={styles.listaScroll}
                    renderItem={({ item }) => {
                      const seleccionado =
                        item === horaSeleccionada;

                      return (
                        <TouchableOpacity
                          style={[
                            styles.itemRueda,
                            seleccionado &&
                              styles.itemSeleccionado,
                          ]}
                          onPress={() =>
                            setHoraSeleccionada(item)
                          }
                        >
                          <Text
                            style={[
                              styles.textoItemRueda,
                              seleccionado &&
                                styles.textoItemSeleccionado,
                            ]}
                          >
                            {item}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                  />
                </View>

                <Text style={styles.separadorHoras}>
                  :
                </Text>

                {/* MINUTOS */}
                <View style={styles.columnaRueda}>
                  <Text style={styles.labelColumna}>
                    MINUTOS
                  </Text>

                  <FlatList
                    data={minutos}
                    keyExtractor={(item) => `m-${item}`}
                    showsVerticalScrollIndicator={false}
                    getItemLayout={(data, index) => ({
                      length: 40,
                      offset: 40 * index,
                      index,
                    })}
                    contentContainerStyle={styles.listaScroll}
                    renderItem={({ item }) => {
                      const seleccionado =
                        item === minutoSeleccionado;

                      return (
                        <TouchableOpacity
                          style={[
                            styles.itemRueda,
                            seleccionado &&
                              styles.itemSeleccionado,
                          ]}
                          onPress={() =>
                            setMinutoSeleccionado(item)
                          }
                        >
                          <Text
                            style={[
                              styles.textoItemRueda,
                              seleccionado &&
                                styles.textoItemSeleccionado,
                            ]}
                          >
                            {item}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                  />
                </View>
              </View>
            )}

            {/* =========================
                SELECTOR DE FECHA
            ========================= */}
            {pickerType === 'date' && (
              <View style={styles.calendarioContenedor}>
                {Platform.OS === 'web' ? (
                  <Text style={styles.webAviso}>
                    El calendario nativo está disponible
                    principalmente en Android/iOS.
                  </Text>
                ) : (
                  <>
                    <DateTimePicker
                      value={fechaSeleccionada}
                      mode="date"
                      display={
                        Platform.OS === 'ios'
                          ? 'inline'
                          : 'calendar'
                      }
                      minimumDate={
                        minDate
                          ? parseFecha(minDate)
                          : undefined
                      }
                      onChange={handleDateChange}
                      locale="es-ES"
                      themeVariant="light"
                      style={styles.datePicker}
                    />

                    {/* Mostrar fecha seleccionada */}
                    <Text style={styles.fechaSeleccionada}>
                      {formatearFechaLarga(
                        fechaSeleccionada
                      )}
                    </Text>
                  </>
                )}
              </View>
            )}

            {/* =========================
                BOTONES
            ========================= */}
            <View style={styles.filaBotones}>
              <TouchableOpacity
                style={styles.botonCancelar}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.textoBotonCancelar}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botonAceptar}
                onPress={confirmarSeleccion}
              >
                <Text style={styles.textoBotonAceptar}>
                  Aceptar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =====================================================
// FUNCIONES DE FECHA
// =====================================================

function parseFecha(fecha) {
  if (!fecha) {
    return new Date();
  }

  // Si viene como YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [year, month, day] = fecha.split('-').map(Number);

    return new Date(year, month - 1, day);
  }

  const date = new Date(fecha);

  return isNaN(date.getTime())
    ? new Date()
    : date;
}

function formatearFecha(fecha) {
  const year = fecha.getFullYear();
  const month = String(
    fecha.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    fecha.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatearFechaLarga(fecha) {
  return fecha.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  contenedorPrincipal: {
    width: '100%',
  },

  inputContenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },

  textoInputOculto: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },

  textoVisible: {
    fontSize: 15,
    color: '#333',
  },

  placeholder: {
    color: '#48d9d9',
  },

  // =========================
  // MODAL
  // =========================

  fondoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  tarjetaModal: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',

    elevation: 10,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },

  tituloModal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },

  subtituloModal: {
    fontSize: 12,
    color: '#60A5A3',
    marginBottom: 16,
    fontWeight: '600',
  },

  // =========================
  // HORA
  // =========================

  selectorRuedasContenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 160,
    width: '100%',
    marginBottom: 20,
  },

  columnaRueda: {
    flex: 1,
    height: 160,
    alignItems: 'center',
  },

  labelColumna: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#888',
    marginBottom: 6,
  },

  listaScroll: {
    paddingVertical: 50,
  },

  itemRueda: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    borderRadius: 8,
  },

  itemSeleccionado: {
    backgroundColor: '#E8F4F2',
    borderWidth: 1,
    borderColor: '#60A5A3',
  },

  textoItemRueda: {
    fontSize: 16,
    color: '#555',
    fontWeight: '500',
  },

  textoItemSeleccionado: {
    fontSize: 18,
    color: '#0A3D4C',
    fontWeight: 'bold',
  },

  separadorHoras: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 8,
    marginTop: 15,
  },

  // =========================
  // CALENDARIO
  // =========================

  calendarioContenedor: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },

  datePicker: {
    width: 300,
    height: 300,
  },

  fechaSeleccionada: {
    marginTop: 8,
    fontSize: 14,
    color: '#0A3D4C',
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  webAviso: {
    textAlign: 'center',
    color: '#777',
    padding: 20,
  },

  // =========================
  // BOTONES
  // =========================

  filaBotones: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
    marginTop: 15,
  },

  botonCancelar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#999',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },

  textoBotonCancelar: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },

  botonAceptar: {
    flex: 1.2,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#60A5A3',
    alignItems: 'center',
  },

  textoBotonAceptar: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
