-- 1. Create tables
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT,
  role TEXT DEFAULT 'user',
  roblox_username TEXT,
  bio TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT,
  following_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS timeline_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  image_data TEXT,
  video_path TEXT,
  repost_id TEXT,
  views_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS timeline_likes (
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS timeline_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  views_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Clear old data if any
DELETE FROM users;
DELETE FROM follows;
DELETE FROM timeline_posts;

-- 3. Insert mock users
INSERT INTO users (id, username, avatar, role, roblox_username, bio) VALUES 
('test-user-1', 'テストユーザー', 'https://cdn.discordapp.com/embed/avatars/0.png', 'admin', 'RobloxTest1', 'こんにちは！テスト用の管理アカウントです。'),
('test-user-2', 'たろう', 'https://cdn.discordapp.com/embed/avatars/1.png', 'user', 'RobloxTarou', 'よろしくお願いします！車が大好きです。'),
('test-user-3', 'はなこ', 'https://cdn.discordapp.com/embed/avatars/2.png', 'user', 'RobloxHanako', 'お散歩中。みんなよろしく！');

-- 4. Insert mock follows (test-user-1 has 1 following, 2 followers)
INSERT INTO follows (follower_id, following_id) VALUES
('test-user-1', 'test-user-2'), -- test-user-1 follows test-user-2
('test-user-2', 'test-user-1'), -- test-user-2 follows test-user-1
('test-user-3', 'test-user-1'); -- test-user-3 follows test-user-1

-- 5. Insert mock posts
INSERT INTO timeline_posts (id, user_id, content, views_count) VALUES
('post-1', 'test-user-1', 'タイムラインの初投稿です！', 100),
('post-2', 'test-user-2', '今日納車されたマイカーです。かっこいい！', 250);
