CREATE TABLE IF NOT EXISTS chat_mensaje (
  id_mensaje BIGSERIAL PRIMARY KEY,
  id_grupo INTEGER NOT NULL REFERENCES grupo(id_grupo) ON DELETE CASCADE,
  id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('texto', 'imagen', 'documento', 'audio')),
  texto TEXT,
  archivo_url TEXT,
  archivo_nombre TEXT,
  mime_type VARCHAR(150),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chat_mensaje_contenido_valido CHECK (
    (tipo = 'texto' AND texto IS NOT NULL AND length(trim(texto)) > 0)
    OR (tipo <> 'texto' AND archivo_url IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS chat_mensaje_grupo_fecha_idx
  ON chat_mensaje (id_grupo, creado_en, id_mensaje);
