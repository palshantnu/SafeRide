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
