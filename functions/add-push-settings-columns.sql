-- Add subscription toggle columns if they don't exist
ALTER TABLE user_push_tokens ADD COLUMN results_enabled INTEGER DEFAULT 1;
ALTER TABLE user_push_tokens ADD COLUMN admin_enabled INTEGER DEFAULT 1;
