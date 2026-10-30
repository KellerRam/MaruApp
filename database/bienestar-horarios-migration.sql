-- Horas personalizadas para la alerta de bienestar (formato "HH:MM,HH:MM", máximo 5).
-- Si es NULL se usan las horas predeterminadas (08:00, 12:00, 16:00, 19:00, 22:00).
ALTER TABLE paciente
  ADD COLUMN IF NOT EXISTS bienestar_horarios TEXT;

CREATE INDEX IF NOT EXISTS alerta_notificacion_pendientes_idx
  ON alerta_notificacion (tipo, leida, primer_envio);
