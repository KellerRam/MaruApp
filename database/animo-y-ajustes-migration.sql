-- Estado de ánimo del paciente: nivel elegido (mal, regular, bien, muy_bien). NULL en registros anteriores.
ALTER TABLE sintoma
  ADD COLUMN IF NOT EXISTS animo VARCHAR(10);

-- Preferencias de notificaciones de cada usuario (se guardan en el servidor, no en el teléfono).
ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS notif_medicamentos BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_eventos BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_emergencia BOOLEAN NOT NULL DEFAULT true;
