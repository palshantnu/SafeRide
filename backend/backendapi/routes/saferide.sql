-- MySQL dump 10.13  Distrib 8.0.45, for Linux (x86_64)
--
-- Host: localhost    Database: saferide
-- ------------------------------------------------------
-- Server version	8.0.45-0ubuntu0.24.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `ba_otps`
--

DROP TABLE IF EXISTS `ba_otps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ba_otps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ba_mobile` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `otp` varchar(6) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ba_otps`
--

LOCK TABLES `ba_otps` WRITE;
/*!40000 ALTER TABLE `ba_otps` DISABLE KEYS */;
INSERT INTO `ba_otps` VALUES (7,'987654321','156211','2026-04-07 16:36:57','2026-04-07 11:01:57'),(8,'987654321','727573','2026-04-07 16:39:07','2026-04-07 11:04:07'),(12,'0987654321','270223','2026-04-07 16:57:30','2026-04-07 11:22:30'),(13,'0000000000','555803','2026-04-07 16:57:34','2026-04-07 11:22:34'),(25,'9425111876','378829','2026-04-11 12:35:44','2026-04-11 07:00:44'),(27,'9131418874','538113','2026-04-24 10:58:02','2026-04-24 05:23:02'),(30,'94251118876','903569','2026-05-02 04:59:44','2026-05-02 04:54:43'),(31,'94251118876','940810','2026-05-02 05:14:20','2026-05-02 05:09:19'),(37,'94251118876','903714','2026-05-04 11:01:25','2026-05-04 10:56:25'),(39,'9424111887','206407','2026-05-04 12:12:01','2026-05-04 12:07:00'),(43,'9425111876','179834','2026-05-07 07:20:36','2026-05-07 07:15:36');
/*!40000 ALTER TABLE `ba_otps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ba_services`
--

DROP TABLE IF EXISTS `ba_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ba_services` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ba_id` int DEFAULT NULL,
  `service_id` int DEFAULT NULL,
  `commission_rate` decimal(5,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `service_id` (`service_id`),
  CONSTRAINT `ba_services_ibfk_1` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ba_services`
--

LOCK TABLES `ba_services` WRITE;
/*!40000 ALTER TABLE `ba_services` DISABLE KEYS */;
INSERT INTO `ba_services` VALUES (3,27,5,0.00,'2026-04-06 09:47:08'),(4,27,2,0.00,'2026-04-06 09:47:08'),(13,39,1,0.00,'2026-04-07 11:17:32'),(14,39,2,0.00,'2026-04-07 11:17:32'),(15,40,1,0.00,'2026-04-07 11:23:26'),(16,40,2,0.00,'2026-04-07 11:23:26'),(17,41,1,0.00,'2026-04-07 11:30:54'),(18,41,2,0.00,'2026-04-07 11:30:54');
/*!40000 ALTER TABLE `ba_services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `booking_meter_images`
--

DROP TABLE IF EXISTS `booking_meter_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `booking_meter_images` (
  `id` int NOT NULL AUTO_INCREMENT,
  `booking_id` int NOT NULL,
  `image_type` enum('STARTED','TOPUP','COMPLETE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `image` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `meter_text` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `booking_meter_images`
--

LOCK TABLES `booking_meter_images` WRITE;
/*!40000 ALTER TABLE `booking_meter_images` DISABLE KEYS */;
/*!40000 ALTER TABLE `booking_meter_images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `booking_topups`
--

DROP TABLE IF EXISTS `booking_topups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `booking_topups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `booking_id` int NOT NULL,
  `extra_km` decimal(10,2) NOT NULL DEFAULT '0.00',
  `price_per_km` decimal(10,2) NOT NULL DEFAULT '0.00',
  `topup_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('PENDING','PAID','REJECTED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at` timestamp NULL DEFAULT NULL,
  `topup_otp` int DEFAULT NULL,
  `otp_verified` tinyint(1) DEFAULT '0',
  `payment_mode` enum('CASH','ONLINE') COLLATE utf8mb4_unicode_ci DEFAULT 'CASH',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_booking_id` (`booking_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_booking_topups_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `booking_topups`
--

LOCK TABLES `booking_topups` WRITE;
/*!40000 ALTER TABLE `booking_topups` DISABLE KEYS */;
/*!40000 ALTER TABLE `booking_topups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bookings`
--

DROP TABLE IF EXISTS `bookings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bookings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `booking_id` varchar(63) DEFAULT NULL,
  `user_id` int NOT NULL,
  `driver_id` int DEFAULT NULL,
  `bussinessassociate_id` int DEFAULT NULL,
  `service_id` int DEFAULT NULL,
  `sub_service_id` int DEFAULT NULL,
  `plan_id` int DEFAULT NULL,
  `booking_type` enum('0','1','2') NOT NULL COMMENT '0-Instant,1-Schedule, 2-Other',
  `status` enum('PENDING','SEARCHING','ASSIGN','ACCEPTED','TOKEN_PAID','ARRIVED','STARTED','PICKEDUP','DROPPED','TOPUP_PENDING','BALANCE_PAID','COMPLETED','CANCELLED','SCHEDULED','OTP_VERIFIED') NOT NULL,
  `user_status` enum('PENDING','SEARCHING','CONFIRMED','ARRIVED','STARTED','PICKEDUP','DROPPED','BALANCE_PENDING','BALANCE_PAID','TOPUP_REQUESTED','TOPUP_PAID','COMPLETED','CANCELLED','SCHEDULED') DEFAULT 'PENDING',
  `driver_status` enum('PENDING','SEARCHING','ACCEPTED','REASSIGN','ARRIVED','STARTED','PICKEDUP','DROPPED','AWAITING_TOPUP_PAYMENT','COMPLETED','CANCELLED','SCHEDULED') DEFAULT 'PENDING',
  `cancelled_by` enum('NONE','USER','DRIVER','AUTOMATIC','BUSINESS_ASSOCIATE') NOT NULL DEFAULT 'NONE',
  `cancel_reason` varchar(255) DEFAULT NULL,
  `amount` bigint DEFAULT NULL,
  `topup_amount` int DEFAULT NULL,
  `token_amount` int DEFAULT NULL,
  `payment_mode` enum('CASH','ONLINE') NOT NULL DEFAULT 'CASH',
  `paid` int NOT NULL DEFAULT '0',
  `paid_at` timestamp NULL DEFAULT NULL,
  `distance` double(15,2) DEFAULT NULL,
  `total_fare` decimal(10,2) DEFAULT NULL,
  `actual_distance` decimal(10,2) DEFAULT NULL,
  `actual_fare` decimal(10,2) DEFAULT NULL,
  `platform_fee` decimal(10,2) DEFAULT '0.00',
  `cancellation_fee` decimal(10,2) DEFAULT '0.00',
  `schedule_date` datetime DEFAULT NULL,
  `person` int DEFAULT NULL,
  `user_rated` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0-None, 1-Good, 2-Bad',
  `driver_rated` tinyint(1) DEFAULT '0' COMMENT '0-None, 1-Good, 2-Bad',
  `user_review` text,
  `driver_review` text,
  `use_wallet` tinyint(1) NOT NULL DEFAULT '0',
  `pickup_city` varchar(20) DEFAULT NULL,
  `drop_city` varchar(20) DEFAULT NULL,
  `to_city` varchar(100) DEFAULT NULL,
  `pickup_address` varchar(1000) DEFAULT NULL,
  `drop_address` varchar(1000) DEFAULT NULL,
  `pickup_location` text,
  `otp` int NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `otp_verified` tinyint(1) DEFAULT '0',
  `balance_paid` tinyint(1) DEFAULT '0',
  `balance_amount` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bookings`
--

LOCK TABLES `bookings` WRITE;
/*!40000 ALTER TABLE `bookings` DISABLE KEYS */;
/*!40000 ALTER TABLE `bookings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `business_associates`
--

DROP TABLE IF EXISTS `business_associates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `business_associates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ba_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ba_mobile` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ba_code` (`ba_mobile`)
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `business_associates`
--

LOCK TABLES `business_associates` WRITE;
/*!40000 ALTER TABLE `business_associates` DISABLE KEYS */;
INSERT INTO `business_associates` VALUES (27,'Rahul','9425111887',1,NULL),(39,'Shantnu ','0987654321',1,NULL),(40,'Udjd','3336663366',1,NULL),(41,'Ufut','2580258025',1,NULL);
/*!40000 ALTER TABLE `business_associates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `driver_documents`
--

DROP TABLE IF EXISTS `driver_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `driver_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `driver_id` int NOT NULL,
  `document_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `document_file` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiry_date` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint DEFAULT '0',
  `remark` text COLLATE utf8mb4_unicode_ci,
  `verified_by` int DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_doc` (`driver_id`,`document_type`),
  CONSTRAINT `driver_documents_ibfk_1` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `driver_documents`
--

LOCK TABLES `driver_documents` WRITE;
/*!40000 ALTER TABLE `driver_documents` DISABLE KEYS */;
INSERT INTO `driver_documents` VALUES (29,3,'4','6u7w7','1775560868335-1000009305.jpg','07/04/2026',1,'Document OK',1,'2026-05-08 14:09:00','2026-04-07 11:21:08','2026-05-08 14:09:00'),(30,2,'4','757485','1776943406377-rn_image_picker_lib_temp_ded0952a-8aef-4857-8616-3dfdaaa1bda9.jpg','23/04/2026',1,'Document OK',1,'2026-05-08 14:09:17','2026-04-23 11:23:26','2026-05-08 14:09:17');
/*!40000 ALTER TABLE `driver_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `driver_otps`
--

DROP TABLE IF EXISTS `driver_otps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `driver_otps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `phone` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `otp` varchar(6) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `driver_otps`
--

LOCK TABLES `driver_otps` WRITE;
/*!40000 ALTER TABLE `driver_otps` DISABLE KEYS */;
INSERT INTO `driver_otps` VALUES (27,'9131418874','917131','2026-04-18 10:46:05','2026-04-18 05:11:05'),(28,'9131418874','526137','2026-04-18 10:46:14','2026-04-18 05:11:14'),(36,'9131418874','237826','2026-04-23 16:40:46','2026-04-23 11:05:46'),(37,'9876543210','846863','2026-04-23 16:42:03','2026-04-23 11:07:03');
/*!40000 ALTER TABLE `driver_otps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `driver_profiles`
--

DROP TABLE IF EXISTS `driver_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `driver_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `driver_id` int NOT NULL,
  `driver_profile` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vehicle_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vehicle_make` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vehicle_model` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vehicle_year` year DEFAULT NULL,
  `vehicle_color` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vehicle_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `seat_capacity` int DEFAULT '4',
  `fuel_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `driver_id` (`driver_id`),
  CONSTRAINT `driver_profiles_ibfk_1` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `driver_profiles`
--

LOCK TABLES `driver_profiles` WRITE;
/*!40000 ALTER TABLE `driver_profiles` DISABLE KEYS */;
/*!40000 ALTER TABLE `driver_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `driver_recharges`
--

DROP TABLE IF EXISTS `driver_recharges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `driver_recharges` (
  `id` int NOT NULL AUTO_INCREMENT,
  `driver_id` int NOT NULL,
  `recharge_id` varchar(100) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `payment_mode` enum('CASH','ONLINE','UPI','CARD','WALLET','BANK_TRANSFER') DEFAULT 'ONLINE',
  `transaction_id` varchar(255) DEFAULT NULL,
  `payment_status` enum('PENDING','SUCCESS','FAILED','REFUNDED') DEFAULT 'PENDING',
  `recharge_status` enum('PENDING','COMPLETED','CANCELLED') DEFAULT 'PENDING',
  `remarks` text,
  `created_by` int DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `recharge_id` (`recharge_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `driver_recharges`
--

LOCK TABLES `driver_recharges` WRITE;
/*!40000 ALTER TABLE `driver_recharges` DISABLE KEYS */;
/*!40000 ALTER TABLE `driver_recharges` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `drivers`
--

DROP TABLE IF EXISTS `drivers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `drivers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `service_id` int DEFAULT NULL,
  `sub_service_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pincode` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ba_id` int DEFAULT NULL,
  `wallet` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `status` enum('pending','approved','blocked') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `is_online` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `phone` (`phone`),
  KEY `service_id` (`service_id`),
  KEY `drivers_ibfk_2` (`ba_id`),
  CONSTRAINT `drivers_ibfk_1` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`),
  CONSTRAINT `drivers_ibfk_2` FOREIGN KEY (`ba_id`) REFERENCES `business_associates` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drivers`
--

LOCK TABLES `drivers` WRITE;
/*!40000 ALTER TABLE `drivers` DISABLE KEYS */;
INSERT INTO `drivers` VALUES (2,'Djdjd','3333333333',1,'1','474004',NULL,'0','approved',1),(3,'Shantnu','1234567890',1,'2','474004',NULL,'0','approved',0),(4,'Ram Driver','9999999999',2,'1','4740',27,'0','approved',1),(5,'Demo','1122334455',2,'5','555555',27,'0','approved',1);
/*!40000 ALTER TABLE `drivers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pages`
--

DROP TABLE IF EXISTS `pages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `page_type` varchar(100) NOT NULL,
  `role` enum('user','driver') NOT NULL DEFAULT 'user',
  `title` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `content` longtext NOT NULL,
  `status` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pages`
--

LOCK TABLES `pages` WRITE;
/*!40000 ALTER TABLE `pages` DISABLE KEYS */;
INSERT INTO `pages` VALUES (1,'custom','user','terms_and_condition','termsandcondition','Test',1,'2026-05-08 17:36:55','2026-05-08 17:36:55'),(2,'privacy','user','privacy_policy','privacypolicy','Testing',1,'2026-05-08 18:42:01','2026-05-08 18:42:01'),(3,'privacy','driver','Privacy Page','privacy-page','<b>What is Lorem Ipsum?\nLorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry\'s standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.</b>',1,'2026-05-08 19:19:42','2026-05-09 09:24:29');
/*!40000 ALTER TABLE `pages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plans`
--

DROP TABLE IF EXISTS `plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service_id` int DEFAULT NULL,
  `sub_service_id` int DEFAULT NULL,
  `plan_name` varchar(255) DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `plan_hour` varchar(255) DEFAULT NULL,
  `plan_km` varchar(255) DEFAULT NULL,
  `token_price` int DEFAULT NULL,
  `topup_price_perkm` int DEFAULT NULL,
  `plan_price` varchar(255) DEFAULT NULL,
  `description` text,
  `status` int NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `booking_destroy_time` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plans`
--

LOCK TABLES `plans` WRITE;
/*!40000 ALTER TABLE `plans` DISABLE KEYS */;
INSERT INTO `plans` VALUES (1,1,36,'Test In city Plan','1753503453.jpg','4','100',NULL,NULL,'1000','NA',1,'2025-07-26 16:47:33','2025-08-17 17:23:55','2025-08-17 17:23:55',10),(2,1,36,'Test In city Plan','1753503603.jpg','4','100',NULL,NULL,'1000','NA',1,'2025-07-26 16:50:03','2025-08-17 17:24:01','2025-08-17 17:24:01',10),(3,1,36,'Test In city Plan','1753503711.jpg','4','100',NULL,NULL,'1000','NA',1,'2025-07-26 16:51:51','2025-08-17 17:24:06','2025-08-17 17:24:06',10),(4,1,36,'Test In city Plan','1753503766.jpg','4','100',NULL,NULL,'1000','NA',1,'2025-07-26 16:52:46','2025-08-17 17:23:48','2025-08-17 17:23:48',10),(5,1,36,'Test In city Plan','1753503794.jpg','4','100',NULL,NULL,'1000','NA',1,'2025-07-26 16:53:14','2025-07-26 17:37:29','2025-07-26 17:37:29',10),(6,1,49,'Test In city Plan','1753506634.jpg','4','100',NULL,NULL,'1000','NA',1,'2025-07-26 17:37:53','2025-07-26 18:37:34','2025-07-26 18:37:34',10),(7,2,55,'One hour','1753509257.png','1','15',NULL,NULL,'200','One hour',1,'2025-07-26 18:24:17','2025-08-17 17:24:12','2025-08-17 17:24:12',10),(8,3,56,'Bhind to Gwalior','1753509380.jpg','0','0',NULL,NULL,'200','bhind',1,'2025-07-26 18:26:20','2025-09-07 05:16:52','2025-09-07 05:16:52',10),(9,4,57,'One way','1753509531.png','0','100',500,50,'2500','Fare 2500 rs',1,'2025-07-26 18:28:51','2026-05-07 12:13:13','2026-05-07 12:13:13',10),(10,5,55,'12 hour','1753510027.png','0','50',NULL,NULL,'500','Driver',1,'2025-07-26 18:37:07','2025-09-05 23:02:45','2025-09-05 23:02:45',10),(11,6,55,'U and me','1753510120.jpg','0','0',NULL,NULL,'0','U and me',1,'2025-07-26 18:38:40','2025-09-05 23:00:58','2025-09-05 23:00:58',10),(12,53,57,'Courier','1753510222.jpg','0','0',NULL,NULL,'0','Logistic',1,'2025-07-26 18:40:22','2026-05-07 12:13:16','2026-05-07 12:13:16',10),(13,5,59,'24 one way','1755253401.png','24','0',NULL,NULL,'600','hi',1,'2025-08-15 22:53:21','2025-09-06 21:34:25','2025-09-06 21:34:25',10),(14,2,55,'One hour','1755408012.png','1','15',50,10,'280','one hour 15 k.m and 280 Rs asfghj jjkkl',1,'2025-08-16 04:35:04','2026-04-17 07:08:30','2025-09-05 23:04:49',10),(15,2,55,'One hour','1757068477.png','1','15',NULL,NULL,'200','nh',1,'2025-09-05 23:04:37','2025-12-27 03:12:02','2025-12-27 03:12:02',10),(16,5,61,'12 hour','1757149776.png','12','0',NULL,NULL,'200','NA',1,'2025-09-06 21:39:36','2025-12-27 21:22:31','2025-12-27 21:22:31',10),(17,5,61,'24 hour','1757149950.png','24','0',NULL,NULL,'200','NA',1,'2025-09-06 21:42:30','2025-12-27 21:22:38','2025-12-27 21:22:38',10),(18,5,61,'12 hour  One way','1757150018.png','12','0',NULL,NULL,'200','na',1,'2025-09-06 21:43:38','2025-12-27 21:22:46','2025-12-27 21:22:46',10),(19,5,61,'24 Hour One way','1757150110.png','24','0',NULL,NULL,'200','NA',1,'2025-09-06 21:45:10','2025-12-27 21:22:53','2025-12-27 21:22:53',10),(20,5,62,'12 hour','1757154302.png','12','0',NULL,NULL,'200',NULL,1,'2025-09-06 22:55:02','2025-12-27 21:28:16','2025-12-27 21:28:16',10),(21,5,62,'24 hour','1757154373.png','24','0',NULL,NULL,'200',NULL,1,'2025-09-06 22:56:13','2025-12-27 21:28:27','2025-12-27 21:28:27',10),(22,5,62,'12 hour One way','1757154454.png','12','0',NULL,NULL,'200',NULL,1,'2025-09-06 22:57:34','2025-12-27 21:28:38','2025-12-27 21:28:38',10),(23,5,62,'24 Hour One way','1757154531.png','24','0',NULL,NULL,'200',NULL,1,'2025-09-06 22:58:51','2025-12-27 21:29:13','2025-12-27 21:29:13',10),(24,5,70,'12 hour','1757154600.png','12','0',NULL,NULL,'200',NULL,1,'2025-09-06 23:00:00','2025-12-27 21:30:34','2025-12-27 21:30:34',10),(25,5,70,'24 hour','1757154647.png','24','0',NULL,NULL,'200',NULL,1,'2025-09-06 23:00:47','2025-12-27 21:30:45','2025-12-27 21:30:45',10),(26,5,70,'12 Hour One way','1757154722.png','12','0',NULL,NULL,'200',NULL,1,'2025-09-06 23:02:02','2025-12-27 21:30:24','2025-12-27 21:30:24',10),(27,5,70,'24 Hour One way','1757154801.png','24','0',NULL,NULL,'200',NULL,1,'2025-09-06 23:03:21','2025-12-27 21:28:06','2025-12-27 21:28:06',10),(28,2,55,'1 hour','1766760082.png','1','14',60,12,'300','Fare 300 rs.\r\n\r\nFix K.M. in this plan 14 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 03:11:22','2026-05-07 12:13:25','2026-05-07 12:13:25',10),(29,2,55,'3 hour','1766760304.png','3','40',120,12,'600','Fare 600 rs.\r\n\r\nFix K.M. in this plan 40 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 03:15:04','2026-03-22 21:56:42',NULL,10),(30,2,55,'6 hour','1766760481.png','6','90',200,12,'1000','Fare 1000 rs\r\n\r\nFix K.M. in this plan 90 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 03:18:01','2026-03-22 21:58:23',NULL,10),(31,2,55,'12 hour','1766760666.png','12','150',360,12,'1800','Fare 1800 rs\r\n\r\nFix K.M. in this plan 150 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 03:21:06','2026-03-22 21:58:52',NULL,10),(32,1,2,'24 hour','1766761317.png','24','250',500,12,'2500','Fare 2500 rs\r\n\r\nFix K.M. in this plan 250 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 03:27:50','2026-05-08 07:29:19',NULL,10),(33,2,65,'1 hour','1766765450.png','1','14',70,12,'350','Fare 350 rs\r\n\r\nFix K.M. in this plan 14 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 04:40:50','2026-03-22 22:00:13',NULL,10),(34,2,65,'3 hour','1766765569.png','3','40',140,12,'700','Fare 700 rs\r\n\r\nFix K.M. in this plan 40 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 04:42:49','2026-03-22 22:00:34',NULL,10),(35,2,65,'6 hour','1766765682.png','6','90',300,12,'1200','Fare 1200 rs\r\n\r\nFix K.M. in this plan 90 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 04:44:42','2026-03-22 22:01:04',NULL,10),(36,2,65,'12 hour','1766765798.png','12','150',450,12,'2250','Fare 2250 rs\r\n\r\nFix K.M. in this plan 150 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 04:46:38','2026-03-22 22:01:44',NULL,10),(37,2,65,'24 hour','1766765909.png','24','250',600,12,'3000','Fare 3000 rs\r\n\r\nFix K.M. in this plan 250 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 04:48:29','2026-03-22 22:02:11',NULL,10),(38,2,66,'1 hour','1766766130.png','1','14',70,12,'350','Fare 350 rs\r\n\r\nFix K.M. in this plan 14 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 04:52:10','2026-03-22 22:02:34',NULL,10),(39,2,66,'3 hour','1766766222.png','3','40',140,12,'700','Fare 700 rs\r\n\r\nFix K.M. in this plan 40 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 04:53:42','2026-03-22 22:02:57',NULL,10),(40,2,66,'6 hour','1766766397.png','6','90',300,12,'1200','Fare 1200 rs\r\n\r\nFix K.M. in this plan 90 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 04:56:37','2026-03-22 22:03:24',NULL,10),(41,2,66,'12 hour','1766766482.png','12','150',450,12,'2250','Fare 2250 rs\r\n\r\nFix K.M. in this plan 150 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 04:58:02','2026-03-22 22:03:49',NULL,10),(42,2,66,'24 hour','1766766553.png','24','250',600,12,'3000','Fare 3000 rs\r\n\r\nFix K.M. in this plan 250 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 04:59:13','2026-03-22 22:04:17',NULL,10),(43,2,58,'1 hour','1766820025.png','1','14',30,7,'150','Fare 150 rs\r\n\r\nFix K.M. in this plan 14 K.M.\r\nTop-up available 7 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 19:50:25','2026-03-22 22:04:45',NULL,10),(44,2,58,'3 hour','1766820107.png','3','40',70,7,'350','Fare 350 rs\r\n\r\nFix K.M. in this plan 40 K.M.\r\nTop-up available 7 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 19:51:47','2026-03-22 22:05:27',NULL,10),(45,2,58,'6 hour','1766820180.png','6','90',120,7,'600','Fare 600 rs\r\n\r\nFix K.M. in this plan 90 K.M.\r\nTop-up available 7 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 19:53:00','2026-03-22 22:05:51',NULL,10),(46,2,67,'6 hour','1766820338.png','6','90',600,24,'3000','Fare 3000 rs\r\n\r\nFix K.M. in this plan 90 K.M.\r\nTop-up available 24 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 19:55:38','2026-03-22 22:06:11',NULL,10),(47,2,67,'12 hour','1766820431.png','12','150',800,24,'4000','Fare 4000 rs\r\n\r\nFix K.M. in this plan 150 K.M.\r\nTop-up available 24 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 19:57:11','2026-03-22 22:06:34',NULL,10),(48,2,67,'24 hour','1766820516.png','24','250',1100,24,'5500','Fare 5500 rs\r\n\r\nFix K.M. in this plan 250 K.M.\r\nTop-up available 24 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 19:58:36','2026-03-22 22:07:21',NULL,10),(49,2,69,'6 hour','1766820985.png','6','90',600,24,'3000','Fare 3000 rs\r\n\r\nFix K.M. in this plan 90 K.M.\r\nTop-up available 24 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 20:06:25','2026-03-22 22:07:48',NULL,10),(50,2,69,'12 hour','1766821044.png','12','150',800,24,'4000','Fare 4000 rs\r\n\r\nFix K.M. in this plan 150 K.M.\r\nTop-up available 24 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 20:07:24','2026-03-22 22:08:30',NULL,10),(51,2,69,'24 hour','1766821103.png','24','250',1100,24,'5500','Fare 5500 rs\r\n\r\nFix K.M. in this plan 250 K.M.\r\nTop-up available 24 Rs. per km.\r\nToll & parking are not included',1,'2025-12-27 20:08:23','2026-03-22 22:08:57',NULL,10),(52,5,61,'12 hour One way','1766825335.png','12','00',0,0,'00','truck bus',1,'2025-12-27 21:18:55','2025-12-27 21:18:55',NULL,10),(53,5,61,'12 hour Return','1766825396.png','00','00',0,0,'00','truck bus',1,'2025-12-27 21:19:56','2025-12-27 21:19:56',NULL,10),(54,5,61,'24 hour One-way','1766825455.png','00','00',0,0,'00','truck bus',1,'2025-12-27 21:20:55','2025-12-27 21:20:55',NULL,10),(55,5,61,'24 hour Return','1766825532.png','00','00',0,0,'00','truck bus',1,'2025-12-27 21:22:12','2025-12-27 21:29:38',NULL,10),(56,5,62,'12 hour One-way','1766825647.png','12','00',180,0,'900','Fare 900 rs\r\n\r\nReturn fair included \r\nMeal and tea are not necessary \r\nToll & parking are not included',1,'2025-12-27 21:24:07','2026-03-22 22:16:06',NULL,10),(57,5,62,'12 hour Return','1766825700.png','12','00',120,0,'600','Fare 600 rs\r\n\r\nMeal and tea are not necessary \r\nToll & parking are not included',1,'2025-12-27 21:25:00','2026-03-22 22:16:29',NULL,10),(58,5,62,'24 hour One-way','1766825783.png','24','00',275,0,'1350','Fare 1350 rs\r\n\r\nReturn fair included\r\nMeal and tea are not necessary \r\nToll & parking are not included',1,'2025-12-27 21:26:23','2026-03-22 22:16:55',NULL,10),(59,5,62,'24 hour Return','1766825863.png','24','00',180,0,'900','Fare 900 rs\r\n\r\nMeal and tea are not necessary\r\nToll & parking are not included',1,'2025-12-27 21:27:43','2026-03-22 22:17:16',NULL,10),(60,4,77,'1 hour','1766943546.png','1','40',100,20,'500','Fare 500 rs\r\n\r\nTop-up maximum 20 k.m.\r\nTop-up value is 20 per k.m.',1,'2025-12-29 06:09:06','2026-03-22 22:17:36',NULL,10),(61,4,77,'2 hour','1766943635.png','2','70',200,20,'1000','Fare 1000 rs\r\n\r\nTop-up maximum 20 k.m.\r\nTop-up value is 20 per k.m',1,'2025-12-29 06:10:35','2026-03-22 22:17:57',NULL,10),(62,4,78,'1 hour','1766943713.png','1','30',150,20,'600','Fare 600 rs\r\n\r\nTop-up maximum 20 k.m.\r\nTop-up value is 20 per k.m',1,'2025-12-29 06:11:53','2026-03-22 22:18:19',NULL,10),(63,4,79,'1 hour','1766943781.png','1','30',150,20,'600','Fare 600 rs\r\n\r\nTop-up maximum 20 k.m.\r\nTop-up value is 20 per k.m',1,'2025-12-29 06:13:01','2026-03-22 22:18:39',NULL,10),(64,2,55,'1 test','1774095801.png','00','00',1,1,'2','Fare 2 rs\r\nonly for testing',1,'2026-03-22 00:53:21','2026-03-22 22:20:13',NULL,10),(65,2,5,'just Half','1778155895072-356693795037106168.jpg','1','2',51,12,'101','Fare 101 rs\r\nonly for ignorance',1,'2026-03-22 00:57:05','2026-05-09 10:43:16',NULL,10),(66,2,5,'1 hour Basic plan','1778155970008-1776160465_7999.jpg','1','200',200,10,'1500','Test',1,'2026-05-07 12:12:50','2026-05-09 10:43:08',NULL,-1);
/*!40000 ALTER TABLE `plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `providers`
--

DROP TABLE IF EXISTS `providers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `providers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parent_id` int DEFAULT NULL,
  `role` varchar(20) DEFAULT NULL,
  `ownername` varchar(100) DEFAULT NULL,
  `first_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country_code` varchar(23) NOT NULL,
  `mobile_number` bigint DEFAULT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `job_title` varchar(200) DEFAULT NULL,
  `invite_code` varchar(200) DEFAULT NULL,
  `comapny_name` varchar(200) DEFAULT NULL,
  `company_address` varchar(200) DEFAULT NULL,
  `account_no` varchar(200) DEFAULT NULL,
  `routing_no` varchar(200) DEFAULT NULL,
  `insurance_no` varchar(200) DEFAULT NULL,
  `vehicle_make` varchar(200) DEFAULT NULL,
  `vehicle_name` varchar(200) DEFAULT NULL,
  `vehicle_model` varchar(200) DEFAULT NULL,
  `plate_no` varchar(200) DEFAULT NULL,
  `engine_no` varchar(200) DEFAULT NULL,
  `driving_license` varchar(200) DEFAULT NULL,
  `experience_letter` varchar(200) DEFAULT NULL,
  `id_proof` varchar(200) DEFAULT NULL,
  `address_proof` varchar(200) DEFAULT NULL,
  `rc_card` varchar(200) DEFAULT NULL,
  `insurance` varchar(200) DEFAULT NULL,
  `aadhar_front` varchar(200) DEFAULT NULL,
  `aadhar_back` varchar(200) DEFAULT NULL,
  `pan_card` varchar(200) DEFAULT NULL,
  `fitness_certificate` varchar(200) DEFAULT NULL,
  `plate_photo` varchar(200) DEFAULT NULL,
  `taxi_permit` varchar(200) DEFAULT NULL,
  `birth_date` varchar(23) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postcode` int DEFAULT NULL,
  `sia_license` int DEFAULT NULL COMMENT '0-No, 1-Yes',
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `profile_picture` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `rating` decimal(4,2) NOT NULL DEFAULT '0.00',
  `status` varchar(11) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '0' COMMENT '0-offline,1-online',
  `approval_status` int DEFAULT '3',
  `business_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `incorporation_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `abn_number` varchar(255) DEFAULT NULL,
  `business_address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `latitude` double(15,8) DEFAULT NULL,
  `longitude` double(15,8) DEFAULT NULL,
  `otp` mediumint NOT NULL DEFAULT '0',
  `business_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Vehicle_number` varchar(100) DEFAULT NULL,
  `vehiclenumber_text` varchar(30) DEFAULT NULL,
  `service_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `service_name` varchar(255) DEFAULT NULL,
  `main_service_type` int DEFAULT NULL,
  `wallet` double(8,2) NOT NULL DEFAULT '0.00',
  `fcm_token` varchar(2000) DEFAULT NULL,
  `subscription_id` int NOT NULL DEFAULT '0',
  `two_factor_secret` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `two_factor_recovery_codes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `remember_token` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notification_status` int NOT NULL DEFAULT '1',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `device_token` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `provider_email_unique` (`email`),
  UNIQUE KEY `provider_mobile_number_unique` (`mobile_number`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `providers`
--

LOCK TABLES `providers` WRITE;
/*!40000 ALTER TABLE `providers` DISABLE KEYS */;
/*!40000 ALTER TABLE `providers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_document`
--

DROP TABLE IF EXISTS `service_document`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_document` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service_id` int DEFAULT NULL,
  `document_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_document`
--

LOCK TABLES `service_document` WRITE;
/*!40000 ALTER TABLE `service_document` DISABLE KEYS */;
INSERT INTO `service_document` VALUES (1,2,'adhar_front',NULL),(2,2,'adhar_back',NULL),(3,2,'passport',NULL),(4,1,'License',NULL);
/*!40000 ALTER TABLE `service_document` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `services`
--

DROP TABLE IF EXISTS `services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `services` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(163) DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `banner` text,
  `description` text,
  `status` int NOT NULL DEFAULT '1' COMMENT '0-Deactive,1-Active',
  `position` int DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `services`
--

LOCK TABLES `services` WRITE;
/*!40000 ALTER TABLE `services` DISABLE KEYS */;
INSERT INTO `services` VALUES (1,'In City','1778224020968.png','1778224120831.jpg','Test',1,1,NULL,'2022-11-02 11:11:26','2026-05-08 07:08:41'),(2,'Rental','1777298035833.jpg','1778323817883.png','NA',1,NULL,NULL,'2022-11-02 11:14:47','2026-05-09 10:50:21'),(3,'Intercity sharing car','1667372173.png','https://phasetwo.sigiride.com/public/images/banner1755426887.png','NA',0,NULL,NULL,'2022-11-02 11:18:54','2026-04-22 10:50:22'),(4,'One Way','1668830414.png','https://phasetwo.sigiride.com/public/images/banner1755432771.png','NA',0,NULL,NULL,'2022-11-02 11:19:44','2026-04-22 10:50:21'),(5,'Driver','1667372201.png','https://phasetwo.sigiride.com/public/images/banner1755432797.png','NA',0,NULL,NULL,'2022-11-02 11:22:54','2026-04-22 10:50:20'),(6,'Self Sharing','1668946561.png','https://phasetwo.sigiride.com/public/images/banner1755432820.png','earn money',0,NULL,NULL,'2022-11-02 11:24:03','2026-04-22 10:50:14'),(53,'Logistic','1753378280.jpg',NULL,NULL,1,NULL,NULL,'2025-07-25 06:01:20','2026-04-22 11:26:29'),(63,'Rental Sharing',NULL,'https://example.com/icon.png','Professional deep cleaning services for your home',0,NULL,'2026-05-07 12:39:34','2026-04-02 21:24:32','2026-05-07 12:39:34'),(64,'Rental Sharing',NULL,'https://example.com/icon.png','Professional deep cleaning services for your home',1,NULL,'2026-04-23 09:04:29','2026-04-02 21:24:42','2026-04-23 09:04:29'),(65,'Testing','1776934956242.png','1776934956250.png','Hello test',1,6,'2026-04-23 09:04:45','2026-04-23 09:02:36','2026-04-23 09:04:45'),(66,'ug','1778157429043.png','1778157429140.png','this',0,9,NULL,'2026-05-07 12:37:09','2026-05-07 12:38:00');
/*!40000 ALTER TABLE `services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sub_services`
--

DROP TABLE IF EXISTS `sub_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sub_services` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service_id` int DEFAULT NULL,
  `driver_min_wallet_balance` decimal(10,2) DEFAULT NULL,
  `search_area` decimal(10,2) DEFAULT NULL,
  `fixed_charge` decimal(10,2) DEFAULT NULL,
  `fixed_charge_km` decimal(10,2) DEFAULT NULL,
  `charge_after_fixed_per_km` decimal(10,2) DEFAULT NULL,
  `access_fee` decimal(10,2) DEFAULT NULL,
  `access_fee_type` enum('flat','percent') DEFAULT 'flat',
  `platform_fee` decimal(10,2) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `image` text,
  `description` text,
  `user_cancel_before48_type` enum('flat','percent') DEFAULT 'flat',
  `user_cancel_before48_amount` decimal(10,2) DEFAULT 0,
  `user_cancel_24to48_type` enum('flat','percent') DEFAULT 'flat',
  `user_cancel_24to48_amount` decimal(10,2) DEFAULT 0,
  `user_cancel_0to24_type` enum('flat','percent') DEFAULT 'flat',
  `user_cancel_0to24_amount` decimal(10,2) DEFAULT 0,
  `driver_cancel_before48_type` enum('flat','percent') DEFAULT 'flat',
  `driver_cancel_before48_amount` decimal(10,2) DEFAULT 0,
  `driver_cancel_24to48_type` enum('flat','percent') DEFAULT 'flat',
  `driver_cancel_24to48_amount` decimal(10,2) DEFAULT 0,
  `driver_cancel_0to24_type` enum('flat','percent') DEFAULT 'flat',
  `driver_cancel_0to24_amount` decimal(10,2) DEFAULT 0,
  `booking_destroy_min` int DEFAULT NULL,
  `status` int DEFAULT '1' COMMENT '0-Deactive, 1-Active',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `service_id` (`service_id`),
  CONSTRAINT `sub_services_ibfk_1` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sub_services`
--

LOCK TABLES `sub_services` WRITE;
/*!40000 ALTER TABLE `sub_services` DISABLE KEYS */;
INSERT INTO `sub_services` VALUES (1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'scooter','1778219743953-doloaapp.png','Test',NULL,NULL,1,NULL,'2026-04-02 21:19:28','2026-05-08 06:07:10'),(2,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'bike',NULL,NULL,NULL,NULL,1,NULL,'2026-04-02 21:19:34','2026-04-02 21:19:34'),(3,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'car',NULL,NULL,NULL,NULL,1,NULL,'2026-04-02 21:19:40','2026-04-02 21:19:40'),(4,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'auto car','1776947931998-Screenshot_2026-04-23_143555.png','Test',NULL,NULL,1,NULL,'2026-04-02 21:19:45','2026-04-23 12:39:01'),(5,2,50.00,NULL,NULL,NULL,NULL,NULL,NULL,'Big Car','1778223480664-sealimage.png','Test',10.00,10.00,1,NULL,'2026-04-23 12:39:44','2026-05-09 13:07:03'),(6,1,100.00,10.00,10.00,10.00,10.00,15.00,5.00,'sedan','1778331213550-ChatGPT_Image_May_8,_2026,_12_05_12_AM.png','Test',10.00,10.00,1,NULL,'2026-05-09 12:53:33','2026-05-09 13:05:16');
/*!40000 ALTER TABLE `sub_services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_recharges`
--

DROP TABLE IF EXISTS `user_recharges`;
CREATE TABLE `user_recharges` (
  `id`               int NOT NULL AUTO_INCREMENT,
  `user_id`          int NOT NULL,
  `recharge_id`      varchar(100) DEFAULT NULL,
  `amount`           decimal(10,2) NOT NULL DEFAULT '0.00',
  `payment_mode`     enum('CASH','ONLINE','UPI','CARD','BANK_TRANSFER') DEFAULT 'ONLINE',
  `transaction_id`   varchar(255) DEFAULT NULL,
  `payment_status`   enum('PENDING','SUCCESS','FAILED','REFUNDED') DEFAULT 'PENDING',
  `recharge_status`  enum('PENDING','COMPLETED','CANCELLED') DEFAULT 'PENDING',
  `remarks`          text,
  `created_at`       timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `recharge_id` (`recharge_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_recharges_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` text COLLATE utf8mb4_unicode_ci,
  `mobile` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `otp` int DEFAULT NULL,
  `role` enum('user','driver','admin','staff') COLLATE utf8mb4_unicode_ci DEFAULT 'user',
  `status` tinyint DEFAULT '1',
  `profile` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `wallet` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `mobile` (`mobile`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,NULL,NULL,NULL,'9876543210',7423,'user',1,NULL,'2026-03-25 12:45:33',NULL),(2,'Testing','Testing@gmail.com',NULL,'9131418874',1716,'user',1,'1776977618538-img13.jpg','2026-03-31 08:59:42','2026-04-23 20:53:38'),(3,'shantnu pal','shantnu@gmail.com',NULL,'9144937174',6278,'user',1,NULL,'2026-03-31 10:00:28','2026-05-07 06:54:06'),(4,'Gourav','gourav123@gmail.com','$2b$10$jSxl74W6unbmvD61hmmeROGIptxmH3FWBvvKg9jfKHaD5/meIONyC',NULL,NULL,'admin',1,NULL,'2026-04-01 12:39:30',NULL),(5,NULL,NULL,NULL,'1122334456',2360,'user',1,NULL,'2026-04-03 11:29:45',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

--
-- Table structure for table `withdrawal_requests`
--

DROP TABLE IF EXISTS `withdrawal_requests`;
/*!40101 SET @saved_cs_client = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `withdrawal_requests` (
  `id`                  int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_type`           enum('USER','DRIVER') NOT NULL,
  `user_id`             int(10) UNSIGNED NOT NULL,
  `amount`              decimal(10,2) NOT NULL,
  `bank_name`           varchar(100)  DEFAULT NULL,
  `account_number`      varchar(50)   DEFAULT NULL,
  `ifsc_code`           varchar(20)   DEFAULT NULL,
  `account_holder_name` varchar(100)  DEFAULT NULL,
  `upi_id`              varchar(100)  DEFAULT NULL,
  `status`              enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `remarks`             text          DEFAULT NULL,
  `created_at`          datetime      DEFAULT NULL,
  `updated_at`          datetime      DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_type_user_id` (`user_type`,`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-09 19:58:10
