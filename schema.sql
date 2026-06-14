-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- Discord ID
  username TEXT NOT NULL,
  avatar TEXT,
  role TEXT DEFAULT 'user', -- 'user' or 'admin'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  maker TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  trim TEXT,
  color TEXT,
  plate TEXT UNIQUE NOT NULL,
  roblox_username TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  image_data TEXT, -- Base64 encoded compressed image data
  game_type TEXT DEFAULT 'gv', -- 'gv' or 'rc'
  temp_plate TEXT, -- Temporary license plate (e.g., 仮-1234)
  temp_expires_at DATETIME, -- Expiration date for temporary plate
  reviewed_at DATETIME, -- Review date for approved/rejected/temp status
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Questions table (managed by admin panel, used for citizen applications)
CREATE TABLE IF NOT EXISTS questions (
  id          TEXT PRIMARY KEY,
  sort_order  INTEGER NOT NULL,
  question    TEXT NOT NULL,
  type        TEXT NOT NULL,      -- 'radio' | 'checkbox' | 'text'
  choices     TEXT,               -- JSON array of choice strings (NULL for text type)
  answer      TEXT,               -- JSON correct answer(s) (NULL for text type - manual grading)
  is_active   INTEGER DEFAULT 1,  -- 0 = hidden
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Applications table (citizen applications)
CREATE TABLE IF NOT EXISTS applications (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL UNIQUE,
  roblox_username TEXT NOT NULL,
  discord_username TEXT NOT NULL,
  status          TEXT DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  answers         TEXT NOT NULL,          -- JSON of all answers keyed by question id
  auto_score      INTEGER,                -- number of correct auto-graded answers
  auto_score_max  INTEGER,                -- total number of auto-gradeable questions
  reject_reason   TEXT,
  submitted_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at     DATETIME,
  reviewed_by     TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Admin initialization (Placeholder)
-- INSERT INTO users (id, username, role) VALUES ('YOUR_DISCORD_ID', 'AdminName', 'admin');

CREATE TABLE IF NOT EXISTS vehicle_catalog (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User passkeys table for WebAuthn authentication
CREATE TABLE IF NOT EXISTS user_passkeys (
  credential_id TEXT PRIMARY KEY,   -- Base64URL encoded credential ID
  user_id TEXT NOT NULL,            -- users.id (Discord ID)
  public_key TEXT NOT NULL,         -- Base64 or PEM encoded public key
  counter INTEGER DEFAULT 0,        -- Signature counter
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
