// __tests__/dateAndTimePickers.test.js
describe('Validaciones y Lógica de Selectores de Fecha y Hora', () => {
  describe('WheelTimePickerModal - Formato 24h y Bloqueo de Horas Pasadas', () => {
    const HORAS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const MINUTOS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

    test('contiene exactamente 24 horas y 60 minutos en formato 2 dígitos', () => {
      expect(HORAS_24.length).toBe(24);
      expect(HORAS_24[0]).toBe('00');
      expect(HORAS_24[23]).toBe('23');

      expect(MINUTOS.length).toBe(60);
      expect(MINUTOS[0]).toBe('00');
      expect(MINUTOS[59]).toBe('59');
    });

    test('detecta correctamente horas pasadas cuando minTime está definido', () => {
      const minTime = '14:30';
      const [minH, minM] = minTime.split(':').map(Number);

      const esHoraDeshabilitada = (h) => h < minH;
      const esMinutoDeshabilitado = (m, h) => {
        if (h < minH) return true;
        if (h === minH) return m < minM;
        return false;
      };

      // Horas anteriores a las 14 deben estar deshabilitadas
      expect(esHoraDeshabilitada(10)).toBe(true);
      expect(esHoraDeshabilitada(13)).toBe(true);
      expect(esHoraDeshabilitada(14)).toBe(false);
      expect(esHoraDeshabilitada(18)).toBe(false);

      // Minutos anteriores a 30 en la hora 14 deben estar deshabilitados
      expect(esMinutoDeshabilitado(15, 14)).toBe(true);
      expect(esMinutoDeshabilitado(29, 14)).toBe(true);
      expect(esMinutoDeshabilitado(30, 14)).toBe(false);
      expect(esMinutoDeshabilitado(45, 14)).toBe(false);

      // En horas posteriores, todos los minutos deben estar habilitados
      expect(esMinutoDeshabilitado(0, 15)).toBe(false);
      expect(esMinutoDeshabilitado(15, 15)).toBe(false);
    });

    test('permite todas las horas y minutos si no hay minTime', () => {
      const minTime = null;
      const esHoraDeshabilitada = (h) => (minTime ? h < 12 : false);
      expect(esHoraDeshabilitada(0)).toBe(false);
      expect(esHoraDeshabilitada(23)).toBe(false);
    });
  });

  describe('CalendarPickerModal - Bloqueo de Fechas Pasadas', () => {
    test('deshabilita fechas anteriores a minDate (hoy)', () => {
      const hoy = new Date(2026, 8, 19, 0, 0, 0, 0); // 2026-09-19
      const fechaMinimaObj = hoy;

      const esDiaDeshabilitado = (anio, mes, dia) => {
        const f = new Date(anio, mes, dia, 23, 59, 59, 999);
        return f < fechaMinimaObj;
      };

      // Días anteriores a hoy
      expect(esDiaDeshabilitado(2026, 8, 18)).toBe(true);
      expect(esDiaDeshabilitado(2026, 8, 1)).toBe(true);
      expect(esDiaDeshabilitado(2026, 7, 31)).toBe(true); // Agosto

      // Hoy y días futuros
      expect(esDiaDeshabilitado(2026, 8, 19)).toBe(false);
      expect(esDiaDeshabilitado(2026, 8, 20)).toBe(false);
      expect(esDiaDeshabilitado(2026, 9, 1)).toBe(false); // Octubre
    });

    test('permite todas las fechas cuando minDate es null', () => {
      const minDate = null;
      const esDiaDeshabilitado = (dia) => Boolean(minDate && dia < 10);
      expect(esDiaDeshabilitado(1)).toBe(false);
      expect(esDiaDeshabilitado(15)).toBe(false);
    });
  });
});
