-- Run these in your MySQL client / phpMyAdmin

-- 1. Add booking_destroy_time to plans table
ALTER TABLE plans
  ADD COLUMN booking_destroy_time INT DEFAULT NULL;

-- 2. Add booking_destroy_min to sub_services (if not already present)
ALTER TABLE sub_services
  ADD COLUMN booking_destroy_min INT DEFAULT NULL;

-- 3. Add wallet column to users table
ALTER TABLE users
  ADD COLUMN wallet DECIMAL(10,2) NOT NULL DEFAULT '0.00';

-- 4. Add commission & fee columns to plans table
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS topup_captain_commission DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS topup_company_commission DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS plan_captain_commission  DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS plan_company_commission  DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platform_fee             DECIMAL(10,2) DEFAULT '0.00',
  ADD COLUMN IF NOT EXISTS access_fee               DECIMAL(10,2) DEFAULT '0.00';

-- 5. Add commission columns to booking_topups table
ALTER TABLE booking_topups
  ADD COLUMN IF NOT EXISTS captain_commission DECIMAL(10,2) DEFAULT '0.00',
  ADD COLUMN IF NOT EXISTS company_commission DECIMAL(10,2) DEFAULT '0.00';

-- 6. Create user_recharges table
CREATE TABLE IF NOT EXISTS `user_recharges` (
  `id`               INT NOT NULL AUTO_INCREMENT,
  `user_id`          INT NOT NULL,
  `recharge_id`      VARCHAR(100) DEFAULT NULL,
  `amount`           DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  `payment_mode`     ENUM('CASH','ONLINE','UPI','CARD','BANK_TRANSFER') DEFAULT 'ONLINE',
  `transaction_id`   VARCHAR(255) DEFAULT NULL,
  `payment_status`   ENUM('PENDING','SUCCESS','FAILED','REFUNDED') DEFAULT 'PENDING',
  `recharge_status`  ENUM('PENDING','COMPLETED','CANCELLED') DEFAULT 'PENDING',
  `remarks`          TEXT,
  `created_at`       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `recharge_id` (`recharge_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_recharges_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Add created_at (joining date) to drivers table
-- Run `DESCRIBE drivers;` first — only run this ALTER if created_at is not already listed
-- (your MySQL version doesn't support ADD COLUMN IF NOT EXISTS)
ALTER TABLE drivers
  ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP;

-- 8. Create app_banners table (app home-screen slider — Settings > App Slider Banners)
CREATE TABLE IF NOT EXISTS `app_banners` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `title`      VARCHAR(255) DEFAULT NULL,
  `image`      VARCHAR(255) DEFAULT NULL,
  `link_url`   VARCHAR(500) DEFAULT NULL,
  `position`   INT DEFAULT NULL,
  `status`     TINYINT(1) NOT NULL DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Add access_fee to bookings table (In-City access fee, computed at ride completion,
--    was previously only returned in the API response and never persisted — needed for
--    the Accounts module to report the company's share of each In-City booking)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS access_fee DECIMAL(10,2) DEFAULT '0.00';

-- 10. Ride start/finish timestamps — captured when the OTP is verified (ride actually
--     starts) and when the driver completes the ride (meter stops), so the admin history
--     pages can show how long each ride actually took (In-City + Rental/Intercity share
--     the `bookings` table).
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS ride_started_at   TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ride_completed_at TIMESTAMP NULL DEFAULT NULL;

-- 11. Same start/finish timestamps for On-Spot bookings (delivery already has
--     `completed_at` — this adds the missing "work started" timestamp).
ALTER TABLE onspot_bookings
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP NULL DEFAULT NULL;

-- 12. Same start/finish timestamps for Self-Sharing trips (start = driver starts the
--     trip after boarding, finish = driver marks the trip complete).
ALTER TABLE sigi_trips
  ADD COLUMN IF NOT EXISTS started_at   TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL DEFAULT NULL;

-- Note: Parcel bookings already have `pickup_otp_verified_at` (pickup/start) and
-- `delivered_at` / `completed_at` (finish) — no new columns needed there, only the
-- controller SELECTs were missing pickup_otp_verified_at (fixed in parcelController.js).
