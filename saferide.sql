-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 01, 2026 at 01:11 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.1.25

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `saferide`
--

-- --------------------------------------------------------

--
-- Table structure for table `ba_otps`
--

CREATE TABLE `ba_otps` (
  `id` int(11) NOT NULL,
  `ba_mobile` varchar(20) DEFAULT NULL,
  `otp` varchar(6) DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ba_otps`
--

INSERT INTO `ba_otps` (`id`, `ba_mobile`, `otp`, `expires_at`, `created_at`) VALUES
(7, '987654321', '156211', '2026-04-07 16:36:57', '2026-04-07 11:01:57'),
(8, '987654321', '727573', '2026-04-07 16:39:07', '2026-04-07 11:04:07'),
(12, '0987654321', '270223', '2026-04-07 16:57:30', '2026-04-07 11:22:30'),
(13, '0000000000', '555803', '2026-04-07 16:57:34', '2026-04-07 11:22:34'),
(25, '9425111876', '378829', '2026-04-11 12:35:44', '2026-04-11 07:00:44'),
(27, '9131418874', '538113', '2026-04-24 10:58:02', '2026-04-24 05:23:02');

-- --------------------------------------------------------

--
-- Table structure for table `ba_services`
--

CREATE TABLE `ba_services` (
  `id` int(11) NOT NULL,
  `ba_id` int(11) DEFAULT NULL,
  `service_id` int(11) DEFAULT NULL,
  `commission_rate` decimal(5,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ba_services`
--

INSERT INTO `ba_services` (`id`, `ba_id`, `service_id`, `commission_rate`, `created_at`) VALUES
(3, 27, 5, 0.00, '2026-04-06 09:47:08'),
(4, 27, 2, 0.00, '2026-04-06 09:47:08'),
(7, 28, 53, 0.00, '2026-04-06 09:52:29'),
(8, 28, 2, 0.00, '2026-04-06 09:52:29'),
(9, 29, 1, 0.00, '2026-04-06 10:04:40'),
(10, 29, 2, 0.00, '2026-04-06 10:04:40'),
(13, 39, 1, 0.00, '2026-04-07 11:17:32'),
(14, 39, 2, 0.00, '2026-04-07 11:17:32'),
(15, 40, 1, 0.00, '2026-04-07 11:23:26'),
(16, 40, 2, 0.00, '2026-04-07 11:23:26'),
(17, 41, 1, 0.00, '2026-04-07 11:30:54'),
(18, 41, 2, 0.00, '2026-04-07 11:30:54'),
(19, 42, 1, 0.00, '2026-04-07 11:34:23'),
(20, 42, 2, 0.00, '2026-04-07 11:34:23'),
(21, 43, 2, 0.00, '2026-04-07 11:35:04'),
(22, 43, 1, 0.00, '2026-04-07 11:35:04');

-- --------------------------------------------------------

--
-- Table structure for table `bookings`
--

CREATE TABLE `bookings` (
  `id` int(11) NOT NULL,
  `booking_id` varchar(63) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `driver_id` int(20) DEFAULT NULL,
  `bussinessassociate_id` int(10) DEFAULT NULL,
  `service_id` int(11) DEFAULT NULL,
  `plan_id` int(20) DEFAULT NULL,
  `booking_type` enum('0','1','2') NOT NULL COMMENT '0-Instant,1-Schedule, 2-Other',
  `status` enum('PENDING','SEARCHING','ASSIGN','ACCEPTED','TOKEN_PAID','ARRIVED','STARTED','PICKEDUP','DROPPED','TOPUP_PENDING','BALANCE_PAID','COMPLETED','CANCELLED','SCHEDULED','OTP_VERIFIED') NOT NULL,
  `user_status` enum('PENDING','SEARCHING','CONFIRMED','ARRIVED','STARTED','PICKEDUP','DROPPED','BALANCE_PENDING','BALANCE_PAID','TOPUP_REQUESTED','TOPUP_PAID','COMPLETED','CANCELLED','SCHEDULED') DEFAULT 'PENDING',
  `driver_status` enum('PENDING','SEARCHING','ACCEPTED','ARRIVED','STARTED','PICKEDUP','DROPPED','AWAITING_TOPUP_PAYMENT','COMPLETED','CANCELLED','SCHEDULED') DEFAULT 'PENDING',
  `cancelled_by` enum('NONE','USER','DRIVER','AUTOMATIC') NOT NULL,
  `cancel_reason` varchar(255) DEFAULT NULL,
  `amount` bigint(50) DEFAULT NULL,
  `topup_amount` int(20) DEFAULT NULL,
  `token_amount` int(50) DEFAULT NULL,
  `payment_mode` enum('CASH','ONLINE') NOT NULL,
  `paid` int(11) NOT NULL DEFAULT 0,
  `distance` double(15,2) DEFAULT NULL,
  `schedule_date` datetime DEFAULT NULL,
  `person` int(11) DEFAULT NULL,
  `user_rated` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0-None, 1-Good, 2-Bad',
  `driver_rated` tinyint(1) DEFAULT 0 COMMENT '0-None, 1-Good, 2-Bad',
  `user_review` text DEFAULT NULL,
  `driver_review` text DEFAULT NULL,
  `use_wallet` tinyint(1) NOT NULL DEFAULT 0,
  `pickup_city` varchar(20) DEFAULT NULL,
  `drop_city` varchar(20) DEFAULT NULL,
  `pickup_address` varchar(1000) DEFAULT NULL,
  `drop_address` varchar(1000) DEFAULT NULL,
  `pickup_location` text DEFAULT NULL,
  `otp` int(11) NOT NULL DEFAULT 0,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `otp_verified` tinyint(1) DEFAULT 0,
  `balance_paid` tinyint(1) DEFAULT 0,
  `balance_amount` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `bookings`
--

INSERT INTO `bookings` (`id`, `booking_id`, `user_id`, `driver_id`, `bussinessassociate_id`, `service_id`, `plan_id`, `booking_type`, `status`, `user_status`, `driver_status`, `cancelled_by`, `cancel_reason`, `amount`, `topup_amount`, `token_amount`, `payment_mode`, `paid`, `distance`, `schedule_date`, `person`, `user_rated`, `driver_rated`, `user_review`, `driver_review`, `use_wallet`, `pickup_city`, `drop_city`, `pickup_address`, `drop_address`, `pickup_location`, `otp`, `deleted_at`, `created_at`, `updated_at`, `otp_verified`, `balance_paid`, `balance_amount`) VALUES
(1, 'BKD4684457', 2, 4, NULL, 2, 14, '1', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'NONE', NULL, NULL, NULL, 50, 'CASH', 0, NULL, '2026-04-20 10:30:00', 2, 0, 0, NULL, NULL, 0, 'Gwalior', 'Indore', 'Bhopal MP', NULL, '23.2599,77.4126', 6919, NULL, '2026-04-17 11:51:47', '2026-04-17 12:51:12', 1, 1, 230),
(2, 'BK7428D1CD', 2, 1, NULL, 2, 14, '1', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'NONE', NULL, NULL, NULL, 50, 'CASH', 0, NULL, '2026-04-20 10:30:00', 2, 0, 0, NULL, NULL, 0, 'Gwalior', 'Indore', 'Bhopal MP', NULL, '23.2599,77.4126', 3096, NULL, '2026-04-18 05:16:42', '2026-04-18 08:20:19', 1, 1, 230),
(3, 'BK7E856D2B', 3, 1, NULL, 2, 65, '1', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'NONE', NULL, NULL, NULL, 51, 'CASH', 0, NULL, '2026-04-21 12:35:00', 2, 0, 0, NULL, NULL, 0, 'gwalior', 'morena', 'ede', NULL, 'ded32', 3905, NULL, '2026-04-20 08:00:52', '2026-04-20 09:40:11', 1, 1, 50),
(4, 'BK59FBE28D', 3, 1, NULL, 2, 65, '1', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'NONE', NULL, NULL, NULL, 51, 'CASH', 0, NULL, '2026-04-21 12:35:00', 2, 0, 0, NULL, NULL, 0, 'gwalior', 'morena', 'gwaliordeded', NULL, '33.3323', 8452, NULL, '2026-04-20 08:01:45', '2026-04-20 09:39:14', 1, 1, 50),
(5, 'BK73918E28', 3, 1, NULL, 2, 51, '1', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'NONE', NULL, NULL, NULL, 1100, 'CASH', 0, NULL, '2026-04-22 15:11:00', 2, 0, 0, NULL, NULL, 0, 'de', 'dede', 'dede', NULL, '32d', 9161, NULL, '2026-04-20 09:41:21', '2026-04-20 10:29:26', 1, 1, 4400),
(6, 'BK9D27A7AF', 3, 2, NULL, 2, 65, '1', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'NONE', NULL, NULL, NULL, 51, 'CASH', 0, NULL, '2026-04-24 17:30:00', 2, 0, 0, NULL, NULL, 0, 'gwalior', 'morena', 'fhf', NULL, 'khkhkk', 9710, NULL, '2026-04-23 11:06:44', '2026-04-23 11:14:13', 1, 1, 50),
(7, 'BK7877C16F', 2, NULL, NULL, 2, 7, '1', 'CANCELLED', 'CANCELLED', 'CANCELLED', 'USER', 'Testing', NULL, NULL, NULL, 'CASH', 0, NULL, '2026-04-25 10:30:00', 2, 0, 0, NULL, NULL, 0, 'Gwalior', 'Indore', NULL, NULL, NULL, 3889, NULL, '2026-04-24 05:44:11', '2026-04-29 06:04:54', 0, 0, NULL),
(8, 'BK41EC7112', 2, 4, 27, 5, 10, '1', 'ARRIVED', 'ARRIVED', 'ARRIVED', 'NONE', NULL, NULL, NULL, NULL, 'CASH', 0, NULL, '2026-04-25 10:30:00', 2, 0, 0, NULL, NULL, 0, 'Gwalior', 'Indore', NULL, NULL, NULL, 7145, NULL, '2026-04-24 06:04:33', '2026-04-24 08:32:47', 0, 0, NULL),
(9, 'BKDEBD3C8A', 2, 4, NULL, 3, 8, '1', 'CANCELLED', 'CANCELLED', 'CANCELLED', 'DRIVER', 'Testing', NULL, NULL, NULL, 'CASH', 0, NULL, '2026-04-25 10:30:00', 2, 0, 0, NULL, NULL, 0, 'Gwalior', 'Indore', NULL, NULL, NULL, 5068, NULL, '2026-04-24 06:05:45', '2026-04-29 06:10:36', 0, 0, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `booking_meter_images`
--

CREATE TABLE `booking_meter_images` (
  `id` int(11) NOT NULL,
  `booking_id` int(11) NOT NULL,
  `image_type` enum('STARTED','TOPUP','COMPLETE') NOT NULL,
  `image` varchar(255) NOT NULL,
  `meter_text` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `booking_meter_images`
--

INSERT INTO `booking_meter_images` (`id`, `booking_id`, `image_type`, `image`, `meter_text`, `created_at`) VALUES
(1, 1, 'STARTED', '1776426763820.jpg', NULL, '2026-04-17 11:52:43'),
(2, 1, 'TOPUP', '1776427578084.jpg', NULL, '2026-04-17 12:06:18'),
(3, 1, 'COMPLETE', '1776430272657.jpeg', NULL, '2026-04-17 12:51:12'),
(4, 2, 'STARTED', '1776498654903.jpg', NULL, '2026-04-18 07:50:55'),
(5, 2, 'TOPUP', '1776498693437.jpg', NULL, '2026-04-18 07:51:33'),
(6, 2, 'TOPUP', '1776500021796.jpg', NULL, '2026-04-18 08:13:41'),
(7, 2, 'COMPLETE', '1776500419423.jpg', NULL, '2026-04-18 08:20:19'),
(8, 4, 'STARTED', '1776677939314.jpg', NULL, '2026-04-20 09:38:59'),
(9, 4, 'COMPLETE', '1776677954820.jpg', NULL, '2026-04-20 09:39:14'),
(10, 3, 'STARTED', '1776678005611.jpg', NULL, '2026-04-20 09:40:05'),
(11, 3, 'COMPLETE', '1776678011346.jpg', NULL, '2026-04-20 09:40:11'),
(12, 5, 'STARTED', '1776678215250.jpg', NULL, '2026-04-20 09:43:35'),
(13, 5, 'TOPUP', '1776678233615.jpg', NULL, '2026-04-20 09:43:53'),
(14, 5, 'TOPUP', '1776680046139.jpg', NULL, '2026-04-20 10:14:06'),
(15, 5, 'TOPUP', '1776680943318.jpg', NULL, '2026-04-20 10:29:03'),
(16, 5, 'COMPLETE', '1776680966071.jpg', NULL, '2026-04-20 10:29:26'),
(17, 6, 'STARTED', '1776942628477.jpg', NULL, '2026-04-23 11:10:28'),
(18, 6, 'TOPUP', '1776942801427.jpg', NULL, '2026-04-23 11:13:21'),
(19, 6, 'COMPLETE', '1776942853652.jpg', NULL, '2026-04-23 11:14:13');

-- --------------------------------------------------------

--
-- Table structure for table `booking_topups`
--

CREATE TABLE `booking_topups` (
  `id` int(11) NOT NULL,
  `booking_id` int(11) NOT NULL,
  `extra_km` decimal(10,2) NOT NULL DEFAULT 0.00,
  `price_per_km` decimal(10,2) NOT NULL DEFAULT 0.00,
  `topup_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `reason` varchar(255) DEFAULT NULL,
  `status` enum('PENDING','PAID','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `paid_at` timestamp NULL DEFAULT NULL,
  `topup_otp` int(20) DEFAULT NULL,
  `otp_verified` tinyint(1) DEFAULT 0,
  `payment_mode` enum('CASH','ONLINE') DEFAULT 'CASH',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `booking_topups`
--

INSERT INTO `booking_topups` (`id`, `booking_id`, `extra_km`, `price_per_km`, `topup_amount`, `reason`, `status`, `created_at`, `paid_at`, `topup_otp`, `otp_verified`, `payment_mode`, `updated_at`) VALUES
(4, 1, 10.00, 10.00, 100.00, 'End Plan', 'PAID', '2026-04-17 12:06:18', NULL, 4523, 1, NULL, '2026-04-17 12:51:10'),
(5, 2, 10.00, 10.00, 100.00, 'D.ek', 'PAID', '2026-04-18 07:51:33', '2026-04-18 08:00:53', 8324, 1, NULL, '2026-04-18 08:13:22'),
(6, 2, 20.00, 10.00, 200.00, 'Fd', 'PAID', '2026-04-18 08:13:41', '2026-04-18 08:14:02', 7329, 1, NULL, '2026-04-18 08:14:26'),
(7, 5, 100.00, 24.00, 2400.00, 'Buu', 'PAID', '2026-04-20 09:43:53', '2026-04-20 09:52:56', 7978, 1, NULL, '2026-04-20 10:01:50'),
(8, 5, 10.00, 24.00, 240.00, 'Bsb', 'PAID', '2026-04-20 10:14:06', '2026-04-20 10:28:37', 2215, 1, NULL, '2026-04-20 10:28:44'),
(9, 5, 20.00, 24.00, 480.00, 'Cf', 'PAID', '2026-04-20 10:29:03', '2026-04-20 10:29:10', 7214, 1, NULL, '2026-04-20 10:29:17'),
(10, 6, 10.00, 12.00, 120.00, 'For some reason', 'PAID', '2026-04-23 11:13:21', '2026-04-23 11:13:48', 3451, 1, NULL, '2026-04-23 11:13:57');

-- --------------------------------------------------------

--
-- Table structure for table `business_associates`
--

CREATE TABLE `business_associates` (
  `id` int(11) NOT NULL,
  `ba_name` varchar(100) DEFAULT NULL,
  `ba_mobile` varchar(20) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `business_associates`
--

INSERT INTO `business_associates` (`id`, `ba_name`, `ba_mobile`, `created_at`) VALUES
(27, 'Rahul', '9425111887', NULL),
(28, 'Rahul', '94251118898', NULL),
(29, 'Jdjdjdj', '1212121212', NULL),
(39, 'Shantnu ', '0987654321', NULL),
(40, 'Udjd', '3336663366', NULL),
(41, 'Ufut', '2580258025', NULL),
(42, 'Fyfy', '852085208', NULL),
(43, 'Fyf7', '5555555555', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `drivers`
--

CREATE TABLE `drivers` (
  `id` int(11) NOT NULL,
  `full_name` varchar(100) DEFAULT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `service_id` int(11) DEFAULT NULL,
  `sub_service_id` varchar(20) DEFAULT NULL,
  `pincode` varchar(20) DEFAULT NULL,
  `ba_id` int(11) DEFAULT NULL,
  `wallet` varchar(50) DEFAULT '0',
  `status` enum('pending','approved','blocked') DEFAULT 'pending',
  `is_online` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `drivers`
--

INSERT INTO `drivers` (`id`, `full_name`, `phone`, `service_id`, `sub_service_id`, `pincode`, `ba_id`, `wallet`, `status`, `is_online`) VALUES
(2, 'Djdjd', '3333333333', 1, '1', '474004', NULL, '0', 'approved', 1),
(3, 'Shantnu', '1234567890', 1, '2', '474004', NULL, '0', 'pending', 0),
(4, 'Ram Driver', '9999999999', 2, '1', '474004', 27, '0', 'approved', 1);

-- --------------------------------------------------------

--
-- Table structure for table `driver_documents`
--

CREATE TABLE `driver_documents` (
  `id` int(11) NOT NULL,
  `driver_id` int(11) NOT NULL,
  `document_type` varchar(50) NOT NULL,
  `document_number` varchar(100) DEFAULT NULL,
  `document_file` varchar(255) NOT NULL,
  `expiry_date` varchar(20) DEFAULT NULL,
  `status` tinyint(4) DEFAULT 0,
  `remark` text DEFAULT NULL,
  `verified_by` int(11) DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `driver_documents`
--

INSERT INTO `driver_documents` (`id`, `driver_id`, `document_type`, `document_number`, `document_file`, `expiry_date`, `status`, `remark`, `verified_by`, `verified_at`, `created_at`, `updated_at`) VALUES
(29, 3, '4', '6u7w7', '1775560868335-1000009305.jpg', '07/04/2026', 0, 'Jsh', NULL, NULL, '2026-04-07 11:21:08', '2026-04-07 11:21:08'),
(30, 2, '4', '757485', '1776943406377-rn_image_picker_lib_temp_ded0952a-8aef-4857-8616-3dfdaaa1bda9.jpg', '23/04/2026', 0, 'Husis', NULL, NULL, '2026-04-23 11:23:26', '2026-04-23 11:23:26');

-- --------------------------------------------------------

--
-- Table structure for table `driver_otps`
--

CREATE TABLE `driver_otps` (
  `id` int(11) NOT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `otp` varchar(6) DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `driver_otps`
--

INSERT INTO `driver_otps` (`id`, `phone`, `otp`, `expires_at`, `created_at`) VALUES
(27, '9131418874', '917131', '2026-04-18 10:46:05', '2026-04-18 05:11:05'),
(28, '9131418874', '526137', '2026-04-18 10:46:14', '2026-04-18 05:11:14'),
(36, '9131418874', '237826', '2026-04-23 16:40:46', '2026-04-23 11:05:46'),
(37, '9876543210', '846863', '2026-04-23 16:42:03', '2026-04-23 11:07:03');

-- --------------------------------------------------------

--
-- Table structure for table `driver_profiles`
--

CREATE TABLE `driver_profiles` (
  `id` int(11) NOT NULL,
  `driver_id` int(11) NOT NULL,
  `driver_profile` varchar(100) DEFAULT NULL,
  `vehicle_type` varchar(50) NOT NULL,
  `vehicle_make` varchar(100) DEFAULT NULL,
  `vehicle_model` varchar(100) DEFAULT NULL,
  `vehicle_year` year(4) DEFAULT NULL,
  `vehicle_color` varchar(50) DEFAULT NULL,
  `vehicle_number` varchar(50) NOT NULL,
  `seat_capacity` int(11) DEFAULT 4,
  `fuel_type` varchar(50) DEFAULT NULL,
  `is_active` tinyint(4) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `plans`
--

CREATE TABLE `plans` (
  `id` int(11) NOT NULL,
  `service_id` int(11) DEFAULT NULL,
  `sub_service_id` int(11) DEFAULT NULL,
  `plan_name` varchar(255) DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `plan_hour` varchar(255) DEFAULT NULL,
  `plan_km` varchar(255) DEFAULT NULL,
  `token_price` int(20) DEFAULT NULL,
  `topup_price_perkm` int(20) DEFAULT NULL,
  `plan_price` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `status` int(11) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  `driver_amount` int(20) NOT NULL DEFAULT 10
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `plans`
--

INSERT INTO `plans` (`id`, `service_id`, `sub_service_id`, `plan_name`, `image`, `plan_hour`, `plan_km`, `token_price`, `topup_price_perkm`, `plan_price`, `description`, `status`, `created_at`, `updated_at`, `deleted_at`, `driver_amount`) VALUES
(1, 1, 36, 'Test In city Plan', '1753503453.jpg', '4', '100', NULL, NULL, '1000', 'NA', 1, '2025-07-26 16:47:33', '2025-08-17 17:23:55', '2025-08-17 17:23:55', 10),
(2, 1, 36, 'Test In city Plan', '1753503603.jpg', '4', '100', NULL, NULL, '1000', 'NA', 1, '2025-07-26 16:50:03', '2025-08-17 17:24:01', '2025-08-17 17:24:01', 10),
(3, 1, 36, 'Test In city Plan', '1753503711.jpg', '4', '100', NULL, NULL, '1000', 'NA', 1, '2025-07-26 16:51:51', '2025-08-17 17:24:06', '2025-08-17 17:24:06', 10),
(4, 1, 36, 'Test In city Plan', '1753503766.jpg', '4', '100', NULL, NULL, '1000', 'NA', 1, '2025-07-26 16:52:46', '2025-08-17 17:23:48', '2025-08-17 17:23:48', 10),
(5, 1, 36, 'Test In city Plan', '1753503794.jpg', '4', '100', NULL, NULL, '1000', 'NA', 1, '2025-07-26 16:53:14', '2025-07-26 17:37:29', '2025-07-26 17:37:29', 10),
(6, 1, 49, 'Test In city Plan', '1753506634.jpg', '4', '100', NULL, NULL, '1000', 'NA', 1, '2025-07-26 17:37:53', '2025-07-26 18:37:34', '2025-07-26 18:37:34', 10),
(7, 2, 55, 'One hour', '1753509257.png', '1', '15', NULL, NULL, '200', 'One hour', 1, '2025-07-26 18:24:17', '2025-08-17 17:24:12', '2025-08-17 17:24:12', 10),
(8, 3, 56, 'Bhind to Gwalior', '1753509380.jpg', '0', '0', NULL, NULL, '200', 'bhind', 1, '2025-07-26 18:26:20', '2025-09-07 05:16:52', '2025-09-07 05:16:52', 10),
(9, 4, 57, 'One way', '1753509531.png', '0', '100', 500, 50, '2500', 'Fare 2500 rs', 1, '2025-07-26 18:28:51', '2026-03-22 22:15:23', NULL, 10),
(10, 5, 55, '12 hour', '1753510027.png', '0', '50', NULL, NULL, '500', 'Driver', 1, '2025-07-26 18:37:07', '2025-09-05 23:02:45', '2025-09-05 23:02:45', 10),
(11, 6, 55, 'U and me', '1753510120.jpg', '0', '0', NULL, NULL, '0', 'U and me', 1, '2025-07-26 18:38:40', '2025-09-05 23:00:58', '2025-09-05 23:00:58', 10),
(12, 53, 57, 'Courier', '1753510222.jpg', '0', '0', NULL, NULL, '0', 'Logistic', 1, '2025-07-26 18:40:22', '2025-07-26 18:40:22', NULL, 10),
(13, 5, 59, '24 one way', '1755253401.png', '24', '0', NULL, NULL, '600', 'hi', 1, '2025-08-15 22:53:21', '2025-09-06 21:34:25', '2025-09-06 21:34:25', 10),
(14, 2, 55, 'One hour', '1755408012.png', '1', '15', 50, 10, '280', 'one hour 15 k.m and 280 Rs asfghj jjkkl', 1, '2025-08-16 04:35:04', '2026-04-17 07:08:30', '2025-09-05 23:04:49', 10),
(15, 2, 55, 'One hour', '1757068477.png', '1', '15', NULL, NULL, '200', 'nh', 1, '2025-09-05 23:04:37', '2025-12-27 03:12:02', '2025-12-27 03:12:02', 10),
(16, 5, 61, '12 hour', '1757149776.png', '12', '0', NULL, NULL, '200', 'NA', 1, '2025-09-06 21:39:36', '2025-12-27 21:22:31', '2025-12-27 21:22:31', 10),
(17, 5, 61, '24 hour', '1757149950.png', '24', '0', NULL, NULL, '200', 'NA', 1, '2025-09-06 21:42:30', '2025-12-27 21:22:38', '2025-12-27 21:22:38', 10),
(18, 5, 61, '12 hour  One way', '1757150018.png', '12', '0', NULL, NULL, '200', 'na', 1, '2025-09-06 21:43:38', '2025-12-27 21:22:46', '2025-12-27 21:22:46', 10),
(19, 5, 61, '24 Hour One way', '1757150110.png', '24', '0', NULL, NULL, '200', 'NA', 1, '2025-09-06 21:45:10', '2025-12-27 21:22:53', '2025-12-27 21:22:53', 10),
(20, 5, 62, '12 hour', '1757154302.png', '12', '0', NULL, NULL, '200', NULL, 1, '2025-09-06 22:55:02', '2025-12-27 21:28:16', '2025-12-27 21:28:16', 10),
(21, 5, 62, '24 hour', '1757154373.png', '24', '0', NULL, NULL, '200', NULL, 1, '2025-09-06 22:56:13', '2025-12-27 21:28:27', '2025-12-27 21:28:27', 10),
(22, 5, 62, '12 hour One way', '1757154454.png', '12', '0', NULL, NULL, '200', NULL, 1, '2025-09-06 22:57:34', '2025-12-27 21:28:38', '2025-12-27 21:28:38', 10),
(23, 5, 62, '24 Hour One way', '1757154531.png', '24', '0', NULL, NULL, '200', NULL, 1, '2025-09-06 22:58:51', '2025-12-27 21:29:13', '2025-12-27 21:29:13', 10),
(24, 5, 70, '12 hour', '1757154600.png', '12', '0', NULL, NULL, '200', NULL, 1, '2025-09-06 23:00:00', '2025-12-27 21:30:34', '2025-12-27 21:30:34', 10),
(25, 5, 70, '24 hour', '1757154647.png', '24', '0', NULL, NULL, '200', NULL, 1, '2025-09-06 23:00:47', '2025-12-27 21:30:45', '2025-12-27 21:30:45', 10),
(26, 5, 70, '12 Hour One way', '1757154722.png', '12', '0', NULL, NULL, '200', NULL, 1, '2025-09-06 23:02:02', '2025-12-27 21:30:24', '2025-12-27 21:30:24', 10),
(27, 5, 70, '24 Hour One way', '1757154801.png', '24', '0', NULL, NULL, '200', NULL, 1, '2025-09-06 23:03:21', '2025-12-27 21:28:06', '2025-12-27 21:28:06', 10),
(28, 2, 55, '1 hour', '1766760082.png', '1', '14', 60, 12, '300', 'Fare 300 rs.\r\n\r\nFix K.M. in this plan 14 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 03:11:22', '2026-03-22 21:57:47', NULL, 10),
(29, 2, 55, '3 hour', '1766760304.png', '3', '40', 120, 12, '600', 'Fare 600 rs.\r\n\r\nFix K.M. in this plan 40 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 03:15:04', '2026-03-22 21:56:42', NULL, 10),
(30, 2, 55, '6 hour', '1766760481.png', '6', '90', 200, 12, '1000', 'Fare 1000 rs\r\n\r\nFix K.M. in this plan 90 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 03:18:01', '2026-03-22 21:58:23', NULL, 10),
(31, 2, 55, '12 hour', '1766760666.png', '12', '150', 360, 12, '1800', 'Fare 1800 rs\r\n\r\nFix K.M. in this plan 150 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 03:21:06', '2026-03-22 21:58:52', NULL, 10),
(32, 2, 55, '24 hour', '1766761317.png', '24', '250', 500, 12, '2500', 'Fare 2500 rs\r\n\r\nFix K.M. in this plan 250 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 03:27:50', '2026-03-22 21:59:29', NULL, 10),
(33, 2, 65, '1 hour', '1766765450.png', '1', '14', 70, 12, '350', 'Fare 350 rs\r\n\r\nFix K.M. in this plan 14 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 04:40:50', '2026-03-22 22:00:13', NULL, 10),
(34, 2, 65, '3 hour', '1766765569.png', '3', '40', 140, 12, '700', 'Fare 700 rs\r\n\r\nFix K.M. in this plan 40 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 04:42:49', '2026-03-22 22:00:34', NULL, 10),
(35, 2, 65, '6 hour', '1766765682.png', '6', '90', 300, 12, '1200', 'Fare 1200 rs\r\n\r\nFix K.M. in this plan 90 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 04:44:42', '2026-03-22 22:01:04', NULL, 10),
(36, 2, 65, '12 hour', '1766765798.png', '12', '150', 450, 12, '2250', 'Fare 2250 rs\r\n\r\nFix K.M. in this plan 150 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 04:46:38', '2026-03-22 22:01:44', NULL, 10),
(37, 2, 65, '24 hour', '1766765909.png', '24', '250', 600, 12, '3000', 'Fare 3000 rs\r\n\r\nFix K.M. in this plan 250 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 04:48:29', '2026-03-22 22:02:11', NULL, 10),
(38, 2, 66, '1 hour', '1766766130.png', '1', '14', 70, 12, '350', 'Fare 350 rs\r\n\r\nFix K.M. in this plan 14 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 04:52:10', '2026-03-22 22:02:34', NULL, 10),
(39, 2, 66, '3 hour', '1766766222.png', '3', '40', 140, 12, '700', 'Fare 700 rs\r\n\r\nFix K.M. in this plan 40 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 04:53:42', '2026-03-22 22:02:57', NULL, 10),
(40, 2, 66, '6 hour', '1766766397.png', '6', '90', 300, 12, '1200', 'Fare 1200 rs\r\n\r\nFix K.M. in this plan 90 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 04:56:37', '2026-03-22 22:03:24', NULL, 10),
(41, 2, 66, '12 hour', '1766766482.png', '12', '150', 450, 12, '2250', 'Fare 2250 rs\r\n\r\nFix K.M. in this plan 150 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 04:58:02', '2026-03-22 22:03:49', NULL, 10),
(42, 2, 66, '24 hour', '1766766553.png', '24', '250', 600, 12, '3000', 'Fare 3000 rs\r\n\r\nFix K.M. in this plan 250 K.M.\r\nTop-up available 12 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 04:59:13', '2026-03-22 22:04:17', NULL, 10),
(43, 2, 58, '1 hour', '1766820025.png', '1', '14', 30, 7, '150', 'Fare 150 rs\r\n\r\nFix K.M. in this plan 14 K.M.\r\nTop-up available 7 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 19:50:25', '2026-03-22 22:04:45', NULL, 10),
(44, 2, 58, '3 hour', '1766820107.png', '3', '40', 70, 7, '350', 'Fare 350 rs\r\n\r\nFix K.M. in this plan 40 K.M.\r\nTop-up available 7 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 19:51:47', '2026-03-22 22:05:27', NULL, 10),
(45, 2, 58, '6 hour', '1766820180.png', '6', '90', 120, 7, '600', 'Fare 600 rs\r\n\r\nFix K.M. in this plan 90 K.M.\r\nTop-up available 7 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 19:53:00', '2026-03-22 22:05:51', NULL, 10),
(46, 2, 67, '6 hour', '1766820338.png', '6', '90', 600, 24, '3000', 'Fare 3000 rs\r\n\r\nFix K.M. in this plan 90 K.M.\r\nTop-up available 24 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 19:55:38', '2026-03-22 22:06:11', NULL, 10),
(47, 2, 67, '12 hour', '1766820431.png', '12', '150', 800, 24, '4000', 'Fare 4000 rs\r\n\r\nFix K.M. in this plan 150 K.M.\r\nTop-up available 24 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 19:57:11', '2026-03-22 22:06:34', NULL, 10),
(48, 2, 67, '24 hour', '1766820516.png', '24', '250', 1100, 24, '5500', 'Fare 5500 rs\r\n\r\nFix K.M. in this plan 250 K.M.\r\nTop-up available 24 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 19:58:36', '2026-03-22 22:07:21', NULL, 10),
(49, 2, 69, '6 hour', '1766820985.png', '6', '90', 600, 24, '3000', 'Fare 3000 rs\r\n\r\nFix K.M. in this plan 90 K.M.\r\nTop-up available 24 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 20:06:25', '2026-03-22 22:07:48', NULL, 10),
(50, 2, 69, '12 hour', '1766821044.png', '12', '150', 800, 24, '4000', 'Fare 4000 rs\r\n\r\nFix K.M. in this plan 150 K.M.\r\nTop-up available 24 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 20:07:24', '2026-03-22 22:08:30', NULL, 10),
(51, 2, 69, '24 hour', '1766821103.png', '24', '250', 1100, 24, '5500', 'Fare 5500 rs\r\n\r\nFix K.M. in this plan 250 K.M.\r\nTop-up available 24 Rs. per km.\r\nToll & parking are not included', 1, '2025-12-27 20:08:23', '2026-03-22 22:08:57', NULL, 10),
(52, 5, 61, '12 hour One way', '1766825335.png', '12', '00', 0, 0, '00', 'truck bus', 1, '2025-12-27 21:18:55', '2025-12-27 21:18:55', NULL, 10),
(53, 5, 61, '12 hour Return', '1766825396.png', '00', '00', 0, 0, '00', 'truck bus', 1, '2025-12-27 21:19:56', '2025-12-27 21:19:56', NULL, 10),
(54, 5, 61, '24 hour One-way', '1766825455.png', '00', '00', 0, 0, '00', 'truck bus', 1, '2025-12-27 21:20:55', '2025-12-27 21:20:55', NULL, 10),
(55, 5, 61, '24 hour Return', '1766825532.png', '00', '00', 0, 0, '00', 'truck bus', 1, '2025-12-27 21:22:12', '2025-12-27 21:29:38', NULL, 10),
(56, 5, 62, '12 hour One-way', '1766825647.png', '12', '00', 180, 0, '900', 'Fare 900 rs\r\n\r\nReturn fair included \r\nMeal and tea are not necessary \r\nToll & parking are not included', 1, '2025-12-27 21:24:07', '2026-03-22 22:16:06', NULL, 10),
(57, 5, 62, '12 hour Return', '1766825700.png', '12', '00', 120, 0, '600', 'Fare 600 rs\r\n\r\nMeal and tea are not necessary \r\nToll & parking are not included', 1, '2025-12-27 21:25:00', '2026-03-22 22:16:29', NULL, 10),
(58, 5, 62, '24 hour One-way', '1766825783.png', '24', '00', 275, 0, '1350', 'Fare 1350 rs\r\n\r\nReturn fair included\r\nMeal and tea are not necessary \r\nToll & parking are not included', 1, '2025-12-27 21:26:23', '2026-03-22 22:16:55', NULL, 10),
(59, 5, 62, '24 hour Return', '1766825863.png', '24', '00', 180, 0, '900', 'Fare 900 rs\r\n\r\nMeal and tea are not necessary\r\nToll & parking are not included', 1, '2025-12-27 21:27:43', '2026-03-22 22:17:16', NULL, 10),
(60, 4, 77, '1 hour', '1766943546.png', '1', '40', 100, 20, '500', 'Fare 500 rs\r\n\r\nTop-up maximum 20 k.m.\r\nTop-up value is 20 per k.m.', 1, '2025-12-29 06:09:06', '2026-03-22 22:17:36', NULL, 10),
(61, 4, 77, '2 hour', '1766943635.png', '2', '70', 200, 20, '1000', 'Fare 1000 rs\r\n\r\nTop-up maximum 20 k.m.\r\nTop-up value is 20 per k.m', 1, '2025-12-29 06:10:35', '2026-03-22 22:17:57', NULL, 10),
(62, 4, 78, '1 hour', '1766943713.png', '1', '30', 150, 20, '600', 'Fare 600 rs\r\n\r\nTop-up maximum 20 k.m.\r\nTop-up value is 20 per k.m', 1, '2025-12-29 06:11:53', '2026-03-22 22:18:19', NULL, 10),
(63, 4, 79, '1 hour', '1766943781.png', '1', '30', 150, 20, '600', 'Fare 600 rs\r\n\r\nTop-up maximum 20 k.m.\r\nTop-up value is 20 per k.m', 1, '2025-12-29 06:13:01', '2026-03-22 22:18:39', NULL, 10),
(64, 2, 55, '1 test', '1774095801.png', '00', '00', 1, 1, '2', 'Fare 2 rs\r\nonly for testing', 1, '2026-03-22 00:53:21', '2026-03-22 22:20:13', NULL, 10),
(65, 2, 55, '101', '1774096025.png', '1', '2', 51, 12, '101', 'Fare 101 rs\r\nonly for ignorance', 1, '2026-03-22 00:57:05', '2026-03-22 22:19:44', NULL, 10);

-- --------------------------------------------------------

--
-- Table structure for table `providers`
--

CREATE TABLE `providers` (
  `id` int(11) NOT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `role` varchar(20) DEFAULT NULL,
  `ownername` varchar(100) DEFAULT NULL,
  `first_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country_code` varchar(23) NOT NULL,
  `mobile_number` bigint(50) DEFAULT NULL,
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
  `postcode` int(11) DEFAULT NULL,
  `sia_license` int(11) DEFAULT NULL COMMENT '0-No, 1-Yes',
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `profile_picture` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rating` decimal(4,2) NOT NULL DEFAULT 0.00,
  `status` varchar(11) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '0' COMMENT '0-offline,1-online',
  `approval_status` int(50) DEFAULT 3,
  `business_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `incorporation_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `abn_number` varchar(255) DEFAULT NULL,
  `business_address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` double(15,8) DEFAULT NULL,
  `longitude` double(15,8) DEFAULT NULL,
  `otp` mediumint(9) NOT NULL DEFAULT 0,
  `business_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Vehicle_number` varchar(100) DEFAULT NULL,
  `vehiclenumber_text` varchar(30) DEFAULT NULL,
  `service_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `service_name` varchar(255) DEFAULT NULL,
  `main_service_type` int(11) DEFAULT NULL,
  `wallet` double(8,2) NOT NULL DEFAULT 0.00,
  `fcm_token` varchar(2000) DEFAULT NULL,
  `subscription_id` int(11) NOT NULL DEFAULT 0,
  `two_factor_secret` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `two_factor_recovery_codes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remember_token` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notification_status` int(5) NOT NULL DEFAULT 1,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `device_token` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `services`
--

CREATE TABLE `services` (
  `id` int(11) NOT NULL,
  `title` varchar(163) DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `banner` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `status` int(11) NOT NULL DEFAULT 1 COMMENT '0-Deactive,1-Active',
  `position` int(20) DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `services`
--

INSERT INTO `services` (`id`, `title`, `image`, `banner`, `description`, `status`, `position`, `deleted_at`, `created_at`, `updated_at`) VALUES
(1, 'In City', '1776928934678.png', '1776931252615.png', 'Test', 1, 1, NULL, '2022-11-02 11:11:26', '2026-04-27 13:52:20'),
(2, 'Rental', '1777298035833.jpg', 'https://phasetwo.sigiride.com/public/images/banner1755410316.png', 'NA', 0, NULL, NULL, '2022-11-02 11:14:47', '2026-04-27 13:53:55'),
(3, 'Intercity sharing car', '1667372173.png', 'https://phasetwo.sigiride.com/public/images/banner1755426887.png', 'NA', 0, NULL, NULL, '2022-11-02 11:18:54', '2026-04-22 10:50:22'),
(4, 'One Way', '1668830414.png', 'https://phasetwo.sigiride.com/public/images/banner1755432771.png', 'NA', 0, NULL, NULL, '2022-11-02 11:19:44', '2026-04-22 10:50:21'),
(5, 'Driver', '1667372201.png', 'https://phasetwo.sigiride.com/public/images/banner1755432797.png', 'NA', 0, NULL, NULL, '2022-11-02 11:22:54', '2026-04-22 10:50:20'),
(6, 'Self Sharing', '1668946561.png', 'https://phasetwo.sigiride.com/public/images/banner1755432820.png', 'earn money', 0, NULL, NULL, '2022-11-02 11:24:03', '2026-04-22 10:50:14'),
(53, 'Logistic', '1753378280.jpg', NULL, NULL, 1, NULL, NULL, '2025-07-25 06:01:20', '2026-04-22 11:26:29'),
(63, 'Rental Sharing', NULL, 'https://example.com/icon.png', 'Professional deep cleaning services for your home', 1, NULL, NULL, '2026-04-02 21:24:32', '2026-04-22 11:26:28'),
(64, 'Rental Sharing', NULL, 'https://example.com/icon.png', 'Professional deep cleaning services for your home', 1, NULL, '2026-04-23 09:04:29', '2026-04-02 21:24:42', '2026-04-23 09:04:29'),
(65, 'Testing', '1776934956242.png', '1776934956250.png', 'Hello test', 1, 6, '2026-04-23 09:04:45', '2026-04-23 09:02:36', '2026-04-23 09:04:45');

-- --------------------------------------------------------

--
-- Table structure for table `service_document`
--

CREATE TABLE `service_document` (
  `id` int(11) NOT NULL,
  `service_id` int(11) DEFAULT NULL,
  `document_type` varchar(100) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `service_document`
--

INSERT INTO `service_document` (`id`, `service_id`, `document_type`, `created_at`) VALUES
(1, 2, 'adhar_front', NULL),
(2, 2, 'adhar_back', NULL),
(3, 2, 'passport', NULL),
(4, 1, 'License', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `sub_services`
--

CREATE TABLE `sub_services` (
  `id` int(11) NOT NULL,
  `service_id` int(11) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `image` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `status` int(11) DEFAULT 1 COMMENT '0-Deactive, 1-Active',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `sub_services`
--

INSERT INTO `sub_services` (`id`, `service_id`, `title`, `image`, `description`, `status`, `deleted_at`, `created_at`, `updated_at`) VALUES
(1, 1, 'scooter', NULL, NULL, 1, NULL, '2026-04-02 21:19:28', '2026-04-02 21:19:28'),
(2, 1, 'bike', NULL, NULL, 1, NULL, '2026-04-02 21:19:34', '2026-04-02 21:19:34'),
(3, 1, 'car', NULL, NULL, 1, NULL, '2026-04-02 21:19:40', '2026-04-02 21:19:40'),
(4, 1, 'auto car', '1776947931998-Screenshot_2026-04-23_143555.png', 'Test', 1, NULL, '2026-04-02 21:19:45', '2026-04-23 12:39:01'),
(5, 2, 'Big Car', '1776947984341-Screenshot_2026-04-23_174012.png', 'Test', 1, NULL, '2026-04-23 12:39:44', '2026-04-27 05:09:12');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `password` text DEFAULT NULL,
  `mobile` varchar(15) DEFAULT NULL,
  `otp` int(11) DEFAULT NULL,
  `role` enum('user','driver','admin','staff') DEFAULT 'user',
  `status` tinyint(4) DEFAULT 1,
  `profile` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password`, `mobile`, `otp`, `role`, `status`, `profile`, `created_at`, `updated_at`) VALUES
(1, NULL, NULL, NULL, '9876543210', 7423, 'user', 1, NULL, '2026-03-25 12:45:33', NULL),
(2, 'Testing', 'Testing@gmail.com', NULL, '9131418874', 1619, 'user', 1, '1776977618538-img13.jpg', '2026-03-31 08:59:42', '2026-04-23 20:53:38'),
(3, NULL, NULL, NULL, '9144937174', 8777, 'user', 1, NULL, '2026-03-31 10:00:28', NULL),
(4, 'Gourav', 'gourav123@gmail.com', '$2b$10$jSxl74W6unbmvD61hmmeROGIptxmH3FWBvvKg9jfKHaD5/meIONyC', NULL, NULL, 'admin', 1, NULL, '2026-04-01 12:39:30', NULL),
(5, NULL, NULL, NULL, '1122334456', 2360, 'user', 1, NULL, '2026-04-03 11:29:45', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `ba_otps`
--
ALTER TABLE `ba_otps`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `ba_services`
--
ALTER TABLE `ba_services`
  ADD PRIMARY KEY (`id`),
  ADD KEY `service_id` (`service_id`);

--
-- Indexes for table `bookings`
--
ALTER TABLE `bookings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `booking_meter_images`
--
ALTER TABLE `booking_meter_images`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `booking_topups`
--
ALTER TABLE `booking_topups`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_booking_id` (`booking_id`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `business_associates`
--
ALTER TABLE `business_associates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ba_code` (`ba_mobile`);

--
-- Indexes for table `drivers`
--
ALTER TABLE `drivers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `phone` (`phone`),
  ADD KEY `service_id` (`service_id`),
  ADD KEY `drivers_ibfk_2` (`ba_id`);

--
-- Indexes for table `driver_documents`
--
ALTER TABLE `driver_documents`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_doc` (`driver_id`,`document_type`);

--
-- Indexes for table `driver_otps`
--
ALTER TABLE `driver_otps`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `driver_profiles`
--
ALTER TABLE `driver_profiles`
  ADD PRIMARY KEY (`id`),
  ADD KEY `driver_id` (`driver_id`);

--
-- Indexes for table `plans`
--
ALTER TABLE `plans`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `providers`
--
ALTER TABLE `providers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `provider_email_unique` (`email`),
  ADD UNIQUE KEY `provider_mobile_number_unique` (`mobile_number`);

--
-- Indexes for table `services`
--
ALTER TABLE `services`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `service_document`
--
ALTER TABLE `service_document`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `sub_services`
--
ALTER TABLE `sub_services`
  ADD PRIMARY KEY (`id`),
  ADD KEY `service_id` (`service_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `mobile` (`mobile`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `ba_otps`
--
ALTER TABLE `ba_otps`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT for table `ba_services`
--
ALTER TABLE `ba_services`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `bookings`
--
ALTER TABLE `bookings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `booking_meter_images`
--
ALTER TABLE `booking_meter_images`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `booking_topups`
--
ALTER TABLE `booking_topups`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `business_associates`
--
ALTER TABLE `business_associates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=44;

--
-- AUTO_INCREMENT for table `drivers`
--
ALTER TABLE `drivers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `driver_documents`
--
ALTER TABLE `driver_documents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT for table `driver_otps`
--
ALTER TABLE `driver_otps`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=42;

--
-- AUTO_INCREMENT for table `driver_profiles`
--
ALTER TABLE `driver_profiles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `plans`
--
ALTER TABLE `plans`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=66;

--
-- AUTO_INCREMENT for table `providers`
--
ALTER TABLE `providers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `services`
--
ALTER TABLE `services`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=66;

--
-- AUTO_INCREMENT for table `service_document`
--
ALTER TABLE `service_document`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `sub_services`
--
ALTER TABLE `sub_services`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `ba_services`
--
ALTER TABLE `ba_services`
  ADD CONSTRAINT `ba_services_ibfk_1` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `booking_topups`
--
ALTER TABLE `booking_topups`
  ADD CONSTRAINT `fk_booking_topups_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `drivers`
--
ALTER TABLE `drivers`
  ADD CONSTRAINT `drivers_ibfk_1` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`),
  ADD CONSTRAINT `drivers_ibfk_2` FOREIGN KEY (`ba_id`) REFERENCES `business_associates` (`id`);

--
-- Constraints for table `driver_documents`
--
ALTER TABLE `driver_documents`
  ADD CONSTRAINT `driver_documents_ibfk_1` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `driver_profiles`
--
ALTER TABLE `driver_profiles`
  ADD CONSTRAINT `driver_profiles_ibfk_1` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `sub_services`
--
ALTER TABLE `sub_services`
  ADD CONSTRAINT `sub_services_ibfk_1` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
