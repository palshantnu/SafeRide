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

-- 13. Parcel and On-Spot bookings previously charged only `plans.plan_price` — the
--     plan's platform_fee/access_fee (flat or percent, same convention as In-City and
--     Intercity/Rental) were never applied. Add the columns needed to persist them.
ALTER TABLE parcel_bookings
  ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT '0.00',
  ADD COLUMN IF NOT EXISTS access_fee   DECIMAL(10,2) DEFAULT '0.00';

ALTER TABLE onspot_bookings
  ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT '0.00',
  ADD COLUMN IF NOT EXISTS access_fee   DECIMAL(10,2) DEFAULT '0.00';

-- 14. Self-Sharing passenger bookings (also used by "Inter city", service_id 73 — both
--     share this same sigi_bookings flow) previously had no platform_fee/access_fee
--     concept at all. Fee config comes from the operating captain's own sub_service
--     (same sub_services table + flat/percent convention used everywhere else), added
--     on top of what the passenger pays — see selfSharingController.createBooking.
ALTER TABLE sigi_bookings
  ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT '0.00',
  ADD COLUMN IF NOT EXISTS access_fee   DECIMAL(10,2) DEFAULT '0.00';

-- 15. Chat Support — one conversation per user/driver with the admin support team,
--     backed by Socket.IO for live delivery + these tables for history/REST fallback.
CREATE TABLE IF NOT EXISTS `chat_conversations` (
  `id`                     INT NOT NULL AUTO_INCREMENT,
  `participant_type`       ENUM('USER','DRIVER') NOT NULL,
  `participant_id`         INT NOT NULL,
  `status`                 ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  `last_message`           TEXT DEFAULT NULL,
  `last_message_at`        TIMESTAMP NULL DEFAULT NULL,
  `unread_by_admin`        INT NOT NULL DEFAULT 0,
  `unread_by_participant`  INT NOT NULL DEFAULT 0,
  `created_at`             TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `participant` (`participant_type`, `participant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id`               INT NOT NULL AUTO_INCREMENT,
  `conversation_id`  INT NOT NULL,
  `sender_type`      ENUM('USER','DRIVER','ADMIN') NOT NULL,
  `sender_id`        INT DEFAULT NULL,
  `message`          TEXT NOT NULL,
  `created_at`       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `conversation_id` (`conversation_id`),
  CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Force Update — one row per (app, platform). The app calls GET /app-version on
--     launch and compares its own installed version against min_version; if it's
--     older AND force_update=1, the app shows a full-screen blocking update prompt
--     (see ForceUpdateGate in both saferide_user and saferide_driver).
CREATE TABLE IF NOT EXISTS `app_versions` (
  `id`               INT NOT NULL AUTO_INCREMENT,
  `app`              ENUM('user','driver') NOT NULL,
  `platform`         ENUM('android','ios') NOT NULL,
  `latest_version`   VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  `min_version`      VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  `force_update`     TINYINT(1) NOT NULL DEFAULT 0,
  `update_message`   VARCHAR(500) DEFAULT NULL,
  `store_url`        VARCHAR(500) DEFAULT NULL,
  `created_at`       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `app_platform` (`app`, `platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `app_versions` (`app`, `platform`, `latest_version`, `min_version`, `force_update`, `store_url`) VALUES
  ('user',   'android', '1.10.5', '1.10.5', 0, 'https://play.google.com/store/apps/details?id=com.sigirideuserstaxi'),
  ('user',   'ios',     '1.10.5', '1.10.5', 0, NULL),
  ('driver', 'android', '1.29',   '1.29',   0, 'https://play.google.com/store/apps/details?id=com.sigiridecaptain'),
  ('driver', 'ios',     '1.29',   '1.29',   0, NULL);

-- 17. Self-Sharing bookings already compute a cancellation charge on cancel
--     (calcCancelCharge in selfSharingController.js — both a passenger cancelling their own
--     seat and a driver cancelling the whole trip), but never persisted who cancelled or how
--     much, so the admin Accounts page couldn't show it for this module (see `bookings.cancelled_by`
--     / `bookings.cancellation_fee`, which already work for rides — this mirrors that here).
ALTER TABLE sigi_bookings
  ADD COLUMN IF NOT EXISTS cancelled_by     ENUM('NONE','USER','DRIVER') NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS cancellation_fee DECIMAL(10,2) DEFAULT '0.00';

-- 18. Parcel and On-Spot bookings already have `cancelled_by`/`cancel_reason` but no charge —
--     cancelling just flipped status, nothing was charged (see old comments in
--     parcelController.js / onspotController.js). Both now compute a cancellation fee the same
--     way Ride does, off the booking's sub_service cancellation policy
--     (sub_services.user_cancel_*/driver_cancel_*, resolved via pb.sub_service_id /
--     ob.sub_service_id, falling back to the chosen plan's sub_service_id for parcel where the
--     booking-level column can be left blank) — only charged once a captain/service man has
--     accepted. Just needs the missing amount column; `cancelled_by`/`cancel_reason` already exist.
ALTER TABLE parcel_bookings
  ADD COLUMN IF NOT EXISTS cancellation_fee DECIMAL(10,2) DEFAULT '0.00';

ALTER TABLE onspot_bookings
  ADD COLUMN IF NOT EXISTS cancellation_fee DECIMAL(10,2) DEFAULT '0.00';

-- 19. Business Associates had no on-duty/off-duty toggle like drivers do (`drivers.is_online`),
--     so getBABookings()/baacceptBooking() couldn't gate new job visibility/acceptance on it.
ALTER TABLE business_associates
  ADD COLUMN IF NOT EXISTS is_online TINYINT(1) NOT NULL DEFAULT 0;

-- 20. Self-Sharing: the captain can now cancel a single passenger's booking (no-show, etc.)
--     without cancelling the whole trip (see selfSharingController.driverCancelBooking) — a
--     new cancelled_by value keeps it distinct from cancelTrip's 'DRIVER' (whole trip
--     cancelled, every booking goes with it) so history/admin can tell the two apart even
--     though the trip itself stays active in the no-show case.
ALTER TABLE sigi_bookings
  MODIFY COLUMN cancelled_by ENUM('NONE','USER','DRIVER','DRIVER_NO_SHOW') NOT NULL DEFAULT 'NONE';
