CREATE TABLE IF NOT EXISTS verificacion_correo (
  correo VARCHAR(254) PRIMARY KEY,
  codigo_hash CHAR(64),
  password_hash TEXT NOT NULL,
  expira_en TIMESTAMPTZ NOT NULL,
  intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  verificado_en TIMESTAMPTZ,
  ultimo_envio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS verificacion_correo_expira_idx
  ON verificacion_correo (expira_en);
