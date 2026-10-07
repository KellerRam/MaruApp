CREATE TABLE IF NOT EXISTS recuperacion_password (
  correo VARCHAR(254) PRIMARY KEY,
  codigo_hash CHAR(64),
  expira_en TIMESTAMPTZ NOT NULL,
  intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  verificado_en TIMESTAMPTZ,
  ultimo_envio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recuperacion_password_expira_idx
  ON recuperacion_password (expira_en);
