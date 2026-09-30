import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function CalendarPickerModal({
  visible,
  onClose,
  value,
  onSelect,
  title = 'Seleccionar fecha',
  minDate = null, // "YYYY-MM-DD" o Date
}) {
  const hoy = new Date();
  const anioHoy = hoy.getFullYear();
  const mesHoy = hoy.getMonth();
  const diaHoy = hoy.getDate();

  const parsearMinDate = () => {
    if (!minDate) return null;
    if (minDate instanceof Date) {
      return new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate(), 0, 0, 0, 0);
    }
    if (typeof minDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(minDate)) {
      const [y, m, d] = minDate.split('-').map(Number);
      return new Date(y, m - 1, d, 0, 0, 0, 0);
    }
    return null;
  };

  const fechaMinimaObj = parsearMinDate();

  const parsearFechaInicial = () => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      const f = new Date(y, m - 1, d, 0, 0, 0, 0);
      if (fechaMinimaObj && f < fechaMinimaObj) {
        return fechaMinimaObj;
      }
      return f;
    }
    return fechaMinimaObj && hoy < fechaMinimaObj ? fechaMinimaObj : hoy;
  };

  const [fechaVista, setFechaVista] = useState(new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState(null); // { anio, mes, dia }

  useEffect(() => {
    if (visible) {
      const inicial = parsearFechaInicial();
      setFechaVista(new Date(inicial.getFullYear(), inicial.getMonth(), 1));
      setDiaSeleccionado({
        anio: inicial.getFullYear(),
        mes: inicial.getMonth(),
        dia: inicial.getDate(),
      });
    }
  }, [visible, value, minDate]);

  const mesActualVista = fechaVista.getMonth();
  const anioActualVista = fechaVista.getFullYear();

  const retrocederMes = () => {
    if (fechaMinimaObj) {
      const mesPrevio = new Date(anioActualVista, mesActualVista - 1, 1);
      const ultimoDiaMesPrevio = new Date(anioActualVista, mesActualVista, 0);
      if (ultimoDiaMesPrevio < fechaMinimaObj) return;
    }
    setFechaVista(new Date(anioActualVista, mesActualVista - 1, 1));
  };

  const avanzarMes = () => {
    setFechaVista(new Date(anioActualVista, mesActualVista + 1, 1));
  };

  const sePuedeRetroceder = () => {
    if (!fechaMinimaObj) return true;
    const ultimoDiaMesPrevio = new Date(anioActualVista, mesActualVista, 0);
    return ultimoDiaMesPrevio >= fechaMinimaObj;
  };

  // Cálculo de días de la cuadrícula
  const primerDiaMes = new Date(anioActualVista, mesActualVista, 1).getDay();
  // Ajuste lunes = 0, domingo = 6
  const espacioInicial = primerDiaMes === 0 ? 6 : primerDiaMes - 1;
  const diasEnMes = new Date(anioActualVista, mesActualVista + 1, 0).getDate();

  const esDiaDeshabilitado = (dia) => {
    if (!fechaMinimaObj) return false;
    const f = new Date(anioActualVista, mesActualVista, dia, 23, 59, 59, 999);
    return f < fechaMinimaObj;
  };

  const esDiaSeleccionado = (dia) => {
    if (!diaSeleccionado) return false;
    return (
      diaSeleccionado.dia === dia &&
      diaSeleccionado.mes === mesActualVista &&
      diaSeleccionado.anio === anioActualVista
    );
  };

  const esDiaHoy = (dia) => {
    return (
      dia === diaHoy &&
      mesActualVista === mesHoy &&
      anioActualVista === anioHoy
    );
  };

  const seleccionarDia = (dia) => {
    if (esDiaDeshabilitado(dia)) return;
    setDiaSeleccionado({
      anio: anioActualVista,
      mes: mesActualVista,
      dia,
    });
  };

  const confirmarSeleccion = () => {
    if (!diaSeleccionado) {
      onClose?.();
      return;
    }
    const { anio, mes, dia } = diaSeleccionado;
    const fechaISO = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    onSelect?.(fechaISO);
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
              </View>

              {/* Navegación del Mes */}
              <View style={estilos.barraMes}>
                <TouchableOpacity
                  onPress={retrocederMes}
                  disabled={!sePuedeRetroceder()}
                  style={[estilos.botonNavMes, !sePuedeRetroceder() && estilos.botonNavDeshabilitado]}
                  activeOpacity={0.7}
                >
                  <Feather name="chevron-left" size={22} color={sePuedeRetroceder() ? '#2B5B66' : '#C8D8D6'} />
                </TouchableOpacity>

                <Text style={estilos.textoMesAnio}>
                  {MESES[mesActualVista]} {anioActualVista}
                </Text>

                <TouchableOpacity onPress={avanzarMes} style={estilos.botonNavMes} activeOpacity={0.7}>
                  <Feather name="chevron-right" size={22} color="#2B5B66" />
                </TouchableOpacity>
              </View>

              {/* Días de la semana */}
              <View style={estilos.filaDiasSemana}>
                {DIAS_SEMANA.map((d, index) => (
                  <View key={`dia-sem-${index}`} style={estilos.celdaCabeceraSemana}>
                    <Text style={estilos.textoCabeceraSemana}>{d}</Text>
                  </View>
                ))}
              </View>

              {/* Cuadrícula de días */}
              <View style={estilos.cuadriculaDias}>
                {/* Espacios vacíos previos al 1er día */}
                {Array.from({ length: espacioInicial }).map((_, idx) => (
                  <View key={`vacio-${idx}`} style={estilos.celdaDiaVacia} />
                ))}

                {/* Celdas de días del mes */}
                {Array.from({ length: diasEnMes }, (_, i) => i + 1).map((dia) => {
                  const deshabilitado = esDiaDeshabilitado(dia);
                  const seleccionado = esDiaSeleccionado(dia);
                  const hoyEs = esDiaHoy(dia);

                  return (
                    <TouchableOpacity
                      key={`dia-${dia}`}
                      style={[
                        estilos.celdaDia,
                        hoyEs && !seleccionado && estilos.celdaHoy,
                        seleccionado && estilos.celdaSeleccionada,
                      ]}
                      disabled={deshabilitado}
                      onPress={() => seleccionarDia(dia)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          estilos.textoDia,
                          hoyEs && !seleccionado && estilos.textoDiaHoy,
                          seleccionado && estilos.textoDiaSeleccionado,
                          deshabilitado && estilos.textoDiaDeshabilitado,
                        ]}
                      >
                        {dia}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {fechaMinimaObj && (
                <Text style={estilos.avisoRestriccion}>
                  * Fechas anteriores no disponibles
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
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  cabecera: {
    marginBottom: 12,
  },
  titulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111111',
  },
  barraMes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  botonNavMes: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F4F9F9',
  },
  botonNavDeshabilitado: {
    opacity: 0.35,
  },
  textoMesAnio: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0A3D4C',
  },
  filaDiasSemana: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 6,
  },
  celdaCabeceraSemana: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  textoCabeceraSemana: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7E9A98',
  },
  cuadriculaDias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  celdaDiaVacia: {
    width: '14.28%',
    height: 38,
  },
  celdaDia: {
    width: '14.28%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
    marginVertical: 1,
  },
  celdaHoy: {
    borderWidth: 1.5,
    borderColor: '#60A5A3',
  },
  celdaSeleccionada: {
    backgroundColor: '#3B7A8C',
  },
  textoDia: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  textoDiaHoy: {
    color: '#0A3D4C',
    fontWeight: 'bold',
  },
  textoDiaSeleccionado: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  textoDiaDeshabilitado: {
    color: '#D0D7D6',
    opacity: 0.5,
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
    marginTop: 16,
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
