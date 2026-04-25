-- ================================================================
--  FixBit v2.1 — Complete Database Schema
--  Includes: users, requests, responses, reviews, messages, shop_images
-- ================================================================

DROP DATABASE IF EXISTS fixbit;
CREATE DATABASE fixbit CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fixbit;

-- ──────────────────────────────────────────────────────────────
--  USERS  (both customers and shops share this table via role)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120),
  email         VARCHAR(150),
  phone         VARCHAR(20) NOT NULL,
  password      VARCHAR(255) NOT NULL,          -- bcrypt hash
  role          ENUM('user','shop') NOT NULL,
  latitude      DECIMAL(10,7),
  longitude     DECIMAL(10,7),
  avg_rating    DECIMAL(3,2) DEFAULT NULL,      -- cached average rating
  banned        TINYINT(1) DEFAULT 0,           -- admin ban flag
  profile_image VARCHAR(255) DEFAULT NULL,      -- profile picture path
  address       TEXT DEFAULT NULL,              -- shop address
  working_hours VARCHAR(100) DEFAULT NULL,      -- e.g., "Mon-Sat 9AM-8PM"
  description   TEXT DEFAULT NULL,              -- shop description
  is_verified   BOOLEAN DEFAULT FALSE,          -- verified shop badge
  completed_jobs INT DEFAULT 0,                 -- number of completed jobs
  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- for recently active status
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_phone (phone),
  UNIQUE KEY uniq_email (email)
);

-- ──────────────────────────────────────────────────────────────
--  REQUESTS  (repair jobs posted by users)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE requests (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  brand            VARCHAR(100),
  model            VARCHAR(100),
  device_type      VARCHAR(20) DEFAULT 'Phone',   -- Phone / Tablet / Laptop
  issue_type       VARCHAR(100),
  description      TEXT,
  image            VARCHAR(255),                  -- comma-separated or single path
  latitude         DECIMAL(10,7),
  longitude        DECIMAL(10,7),
  radius           INT DEFAULT 10,
  status           ENUM('pending','accepted','in_progress','completed','cancelled')
                   DEFAULT 'pending',
  accepted_shop_id INT DEFAULT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (accepted_shop_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_location (latitude, longitude)
);

-- ──────────────────────────────────────────────────────────────
--  RESPONSES  (quotes sent by shops)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE responses (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  request_id  INT NOT NULL,
  shop_id     INT NOT NULL,
  message     TEXT,
  price       DECIMAL(10,2) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_quote (request_id, shop_id),
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id)    REFERENCES users(id)    ON DELETE CASCADE,
  INDEX idx_request_id (request_id),
  INDEX idx_shop_id    (shop_id)
);

-- ──────────────────────────────────────────────────────────────
--  REVIEWS  (user rates shop after job completion)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE reviews (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  request_id  INT NOT NULL,
  user_id     INT NOT NULL,
  shop_id     INT NOT NULL,
  rating      TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_review (request_id, user_id),
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (shop_id)    REFERENCES users(id)    ON DELETE CASCADE,
  INDEX idx_shop_id (shop_id)
);

-- ──────────────────────────────────────────────────────────────
--  MESSAGES  (in-app chat per request)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE messages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  request_id  INT NOT NULL,
  sender_id   INT NOT NULL,
  receiver_id INT NOT NULL,
  body        TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id)  REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id)   REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id)    ON DELETE CASCADE,
  INDEX idx_request_id  (request_id),
  INDEX idx_sender_id   (sender_id),
  INDEX idx_receiver_id (receiver_id)
);

-- ──────────────────────────────────────────────────────────────
--  SHOP_IMAGES  (multiple photos for shop profiles)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE shop_images (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  shop_id     INT NOT NULL,
  image_url   VARCHAR(255) NOT NULL,
  is_primary  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_shop_id (shop_id)
);

-- shop details which we collected from Nehru Place

USE fixbit;
SET @default_password = '$2b$10$ZQz5QZ5QZ5QZ5QZ5QZ5QZueWqL5QZ5QZ5QZ5QZ5QZ5QZ5QZ5QZ5Q';
SET @base_lat = 28.5495;
SET @base_lng = 77.2506;
DELETE FROM users WHERE phone IN ('8744841920','9576152569','8799705881','9958811539','8537858585','8285744902', '7706949324');
INSERT INTO users (name, email, phone, password, role, latitude, longitude, banned, created_at) VALUES ('Shri Kalka Mobile Repair', NULL, '8744841920', @default_password, 'shop', @base_lat, @base_lng, 0, NOW());
INSERT INTO users (name, email, phone, password, role, latitude, longitude, banned, created_at) VALUES ('Expert Team', NULL, '9576152569', @default_password, 'shop', @base_lat, @base_lng + 0.001, 0, NOW());
INSERT INTO users (name, email, phone, password, role, latitude, longitude, banned, created_at) VALUES ('BRC Computer', NULL, '8799705881', @default_password, 'shop', @base_lat + 0.001, @base_lng, 0, NOW());
INSERT INTO users (name, email, phone, password, role, latitude, longitude, banned, created_at) VALUES ('Fone Box', NULL, '9958811539', @default_password, 'shop', @base_lat, @base_lng - 0.001, 0, NOW());
INSERT INTO users (name, email, phone, password, role, latitude, longitude, banned, created_at) VALUES ('JMK', NULL, '8537858585', @default_password, 'shop', @base_lat - 0.001, @base_lng, 0, NOW());
INSERT INTO users (name, email, phone, password, role, latitude, longitude, banned, created_at) VALUES ('Mobi World', NULL, '8285744902', @default_password, 'shop', @base_lat + 0.0007, @base_lng + 0.0007, 0, NOW());