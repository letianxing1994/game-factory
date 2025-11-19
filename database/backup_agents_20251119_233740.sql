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
  `type` varchar(20) NOT NULL COMMENT 'å‘˜å·¥ç±»åž‹ï¼šplanner-ç­–åˆ’ï¼Œartist-ç¾Žæœ¯ï¼Œdeveloper-æŠ€æœ¯ï¼Œtester-æµ‹è¯•ï¼Œmusic-éŸ³ä¹',
  `dimension` varchar(10) DEFAULT NULL COMMENT 'ç»´åº¦ï¼š2dæˆ–3dï¼ˆä»…ç¾Žæœ¯ç±»åž‹éœ€è¦ï¼‰',
  `owner_id` bigint NOT NULL COMMENT 'æ‰€æœ‰è€…ç”¨æˆ·ID',
  `company_id` bigint DEFAULT NULL COMMENT 'æ‰€å±žå…¬å¸ID',
  `ai_model` varchar(50) DEFAULT NULL COMMENT 'AIæ¨¡åž‹ï¼šDeepSeek-R1, GPT-5, Claude-Sonnet-4.5, DALL-E-3, Meshy-4ç­‰ï¼ˆä¸ºç©ºæ—¶ä½¿ç”¨é…ç½®é»˜è®¤æ¨¡åž‹ï¼‰',
  `specialization` varchar(100) DEFAULT NULL COMMENT 'ä¸“ä¸šæ–¹å‘ï¼šç­–åˆ’=RPG/MOBA/SLGç­‰ï¼Œç¾Žæœ¯=realistic/cartoon/pixelç­‰ï¼ŒæŠ€æœ¯=singleplayer/multiplayerç­‰',
  `extra_traits` text COMMENT 'é¢å¤–ç‰¹ç‚¹ï¼ˆå½±å“æç¤ºè¯ï¼‰ï¼šå¦‚"æ“…é•¿C++æ€§èƒ½ä¼˜åŒ–"ã€"ç²¾é€šåƒç´ è‰ºæœ¯é£Žæ ¼"ç­‰',
  `status` varchar(20) DEFAULT 'employed' COMMENT 'çŠ¶æ€ï¼šemployed-åœ¨èŒï¼Œavailable-å¾…ä¸š',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_owner_id` (`owner_id`),
  KEY `idx_company_id` (`company_id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
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

-- Dump completed on 2025-11-19 15:37:29
