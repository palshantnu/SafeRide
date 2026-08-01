-- Add unified admin notifications table
CREATE TABLE IF NOT EXISTS `admin_notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` varchar(64) NOT NULL,
  `source_table` varchar(64) DEFAULT NULL,
  `source_id` int DEFAULT NULL,
  `message` varchar(512) DEFAULT NULL,
  `sub` varchar(256) DEFAULT NULL,
  `payload` json DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_source` (`source_table`,`source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
