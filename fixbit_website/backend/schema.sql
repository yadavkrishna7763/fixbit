-- FixBit Database Schema for TiDB Cloud
-- Run this in your TiDB Cloud SQL Editor

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS fixbit;
USE fixbit;

-- Users table (stores both users and shops)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  email VARCHAR(191) DEFAULT NULL,
  phone VARCHAR(32) DEFAULT NULL,
  normalized_phone VARCHAR(32) DEFAULT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'shop', 'admin') NOT NULL DEFAULT 'user',
  latitude DECIMAL(10, 8) DEFAULT NULL,
  longitude DECIMAL(11, 8) DEFAULT NULL,
  avg_rating DECIMAL(3, 2) DEFAULT NULL,
  profile_image VARCHAR(500) DEFAULT NULL,
  cover_image VARCHAR(500) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  working_hours VARCHAR(191) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  is_verified TINYINT(1) DEFAULT 0,
  is_open TINYINT(1) DEFAULT 1,
  completed_jobs INT DEFAULT 0,
  banned TINYINT(1) DEFAULT 0,
  email_verified_at DATETIME DEFAULT NULL,
  phone_verified_at DATETIME DEFAULT NULL,
  last_active_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_email (email),
  UNIQUE KEY uniq_normalized_phone (normalized_phone),
  INDEX idx_role (role),
  INDEX idx_location (latitude, longitude),
  INDEX idx_banned (banned)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Requests table (repair requests from users)
CREATE TABLE IF NOT EXISTS requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  brand VARCHAR(191) NOT NULL,
  model VARCHAR(191) NOT NULL,
  device_type VARCHAR(191) NOT NULL,
  issue_type VARCHAR(191) NOT NULL,
  description TEXT DEFAULT NULL,
  image VARCHAR(500) DEFAULT NULL,
  latitude DECIMAL(10, 8) DEFAULT NULL,
  longitude DECIMAL(11, 8) DEFAULT NULL,
  radius DECIMAL(10, 2) DEFAULT 10,
  status ENUM('pending', 'accepted', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
  accepted_shop_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (accepted_shop_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_location (latitude, longitude),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Responses table (quotes from shops)
CREATE TABLE IF NOT EXISTS responses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  shop_id INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  message TEXT DEFAULT NULL,
  estimated_time VARCHAR(191) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_request_shop (request_id, shop_id),
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_request (request_id),
  INDEX idx_shop (shop_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Messages table (chat between users and shops)
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  body TEXT DEFAULT NULL,
  image_url VARCHAR(500) DEFAULT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_request (request_id),
  INDEX idx_sender (sender_id),
  INDEX idx_receiver (receiver_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reviews table (user reviews for shops)
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  user_id INT NOT NULL,
  shop_id INT NOT NULL,
  rating DECIMAL(2, 1) NOT NULL,
  comment TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_request (request_id),
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_shop (shop_id),
  INDEX idx_rating (rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(191) NOT NULL,
  body TEXT DEFAULT NULL,
  meta TEXT DEFAULT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Auth OTPs table (for email/phone verification)
CREATE TABLE IF NOT EXISTS auth_otps (
  verification_id VARCHAR(64) PRIMARY KEY,
  purpose ENUM('register', 'password_reset') NOT NULL,
  user_id INT DEFAULT NULL,
  channel ENUM('email', 'phone') NOT NULL,
  destination VARCHAR(191) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  resend_available_at DATETIME NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  send_count INT NOT NULL DEFAULT 1,
  verified_at DATETIME DEFAULT NULL,
  consumed_at DATETIME DEFAULT NULL,
  reset_session_hash VARCHAR(255) DEFAULT NULL,
  reset_session_expires_at DATETIME DEFAULT NULL,
  meta_json TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_auth_otps_purpose_destination (purpose, destination),
  INDEX idx_auth_otps_user (user_id),
  INDEX idx_auth_otps_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create a default admin user (password: admin123 - CHANGE IN PRODUCTION)
INSERT INTO users (name, email, phone, normalized_phone, password, role, is_verified, email_verified_at, phone_verified_at)
VALUES ('Admin', 'admin@fixbit.com', '+919999999999', '+919999999999', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890', 'admin', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE id=id;
