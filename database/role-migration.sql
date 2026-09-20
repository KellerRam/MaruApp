ALTER TABLE grupo_usuario
  ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'cuidador';

CREATE UNIQUE INDEX IF NOT EXISTS grupo_usuario_un_paciente_por_grupo
  ON grupo_usuario (id_grupo)
  WHERE rol = 'paciente';
