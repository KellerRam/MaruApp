ALTER TABLE sintoma
  ALTER COLUMN descripcion TYPE TEXT;

ALTER TABLE sintoma
  ADD COLUMN IF NOT EXISTS nombre_sintoma TEXT;

ALTER TABLE sintoma
  ADD COLUMN IF NOT EXISTS hora_sintoma TIME;

CREATE INDEX IF NOT EXISTS sintoma_usuario_fecha_idx
  ON sintoma (id_usuario, fecha_sintoma, hora_sintoma);
