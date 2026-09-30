ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS apple_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS usuario_apple_user_id_unique
  ON usuario (apple_user_id)
  WHERE apple_user_id IS NOT NULL;
