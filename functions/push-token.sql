CREATE TABLE IF NOT EXISTS user_push_tokens (
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, token)
);
