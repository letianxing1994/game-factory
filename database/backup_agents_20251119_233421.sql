-- MySQL dump 10.13  Distrib 8.0.44, for Linux (x86_64)
--
-- Host: localhost    Database: mydb
-- ------------------------------------------------------
-- Server version	8.0.44

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
-- Table structure for table `agents`
--

DROP TABLE IF EXISTS `agents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agents` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT 'å‘˜å·¥åç§°',
  `type` varchar(20) NOT NULL COMMENT 'å‘˜å·¥ç±»åž‹ï¼šplanner-ç­–åˆ’ï¼Œartist-ç¾Žæœ¯ï¼Œdeveloper-å¼€å‘ï¼Œtester-æµ‹è¯•ï¼Œoperator-è¿è¥',
  `dimension` varchar(10) DEFAULT NULL COMMENT 'ç»´åº¦ï¼š2dæˆ–3dï¼ˆä»…ç¾Žæœ¯ç±»åž‹éœ€è¦ï¼‰',
  `owner_id` bigint NOT NULL COMMENT 'æ‰€æœ‰è€…ç”¨æˆ·ID',
  `company_id` bigint DEFAULT NULL COMMENT 'æ‰€å±žå…¬å¸ID',
  `ai_model` varchar(50) DEFAULT 'GPT-5' COMMENT 'AIæ¨¡åž‹',
  `education` varchar(100) DEFAULT NULL COMMENT 'æ•™è‚²èƒŒæ™¯',
  `specialization` varchar(100) DEFAULT NULL COMMENT 'ä¸“ä¸šæ–¹å‘',
  `skills` json DEFAULT NULL COMMENT 'æŠ€èƒ½æ•°ç»„',
  `experience_level` int DEFAULT '1' COMMENT 'ç»éªŒç­‰çº§ï¼š1-10',
  `efficiency_score` decimal(3,2) DEFAULT '0.50' COMMENT 'æ•ˆçŽ‡è¯„åˆ†ï¼š0.0-1.0',
  `creativity_score` decimal(3,2) DEFAULT '0.50' COMMENT 'åˆ›é€ åŠ›è¯„åˆ†ï¼š0.0-1.0',
  `teamwork_score` decimal(3,2) DEFAULT '0.50' COMMENT 'å›¢é˜Ÿåä½œè¯„åˆ†ï¼š0.0-1.0',
  `salary_cost` decimal(10,2) DEFAULT '1000.00' COMMENT 'è–ªèµ„æˆæœ¬ï¼ˆæ¯æœˆï¼‰',
  `status` varchar(20) DEFAULT 'available' COMMENT 'çŠ¶æ€ï¼šavailable-å¯ç”¨ï¼Œworking-å·¥ä½œä¸­ï¼Œresting-ä¼‘æ¯ä¸­ï¼Œsold-å·²å‡ºå”®',
  `is_on_market` tinyint(1) DEFAULT '0' COMMENT 'æ˜¯å¦åœ¨å¸‚åœºä¸Šå‡ºå”®',
  `market_price` decimal(15,2) DEFAULT NULL COMMENT 'å¸‚åœºä»·æ ¼',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_owner_id` (`owner_id`),
  KEY `idx_company_id` (`company_id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_on_market` (`is_on_market`),
  CONSTRAINT `agents_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`),
  CONSTRAINT `agents_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='å‘˜å·¥Agentè¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `agents`
--

LOCK TABLES `agents` WRITE;
/*!40000 ALTER TABLE `agents` DISABLE KEYS */;
/*!40000 ALTER TABLE `agents` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-19 15:34:10
