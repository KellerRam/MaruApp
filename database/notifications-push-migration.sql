ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS push_token TEXT;

ALTER TABLE paciente
  ADD COLUMN IF NOT EXISTS bienestar_frecuencia INTEGER NOT NULL DEFAULT 1;

-- Rastrea cada ocurrencia de alerta de bienestar/medicamento para reintentos y confirmación de lectura
CREATE TABLE IF NOT EXISTS alerta_notificacion (
  id_alerta BIGSERIAL PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('bienestar', 'medicamento')),
  id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  clave_ocurrencia TEXT NOT NULL,
  primer_envio TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_envio TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  intentos INTEGER NOT NULL DEFAULT 1,
  leida BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (tipo, id_usuario, clave_ocurrencia)
);

-- Evita reenviar el mismo recordatorio de evento (una sola vez, 1 hora antes)
CREATE TABLE IF NOT EXISTS alerta_evento_enviada (
  id_evento INTEGER PRIMARY KEY,
  enviado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
