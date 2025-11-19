-- Game Factory Database Schema
-- 游戏工厂数据库设计

-- 用户表
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名',
    email VARCHAR(100) UNIQUE NOT NULL COMMENT '邮箱',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
    avatar_url VARCHAR(255) COMMENT '头像URL',
    game_coins DECIMAL(15,2) DEFAULT 10000.00 COMMENT '游戏币余额',
    reputation INT DEFAULT 0 COMMENT '声望值',
    status TINYINT DEFAULT 1 COMMENT '状态：1-正常，0-禁用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 游戏币交易记录表
CREATE TABLE coin_transactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    transaction_type VARCHAR(20) NOT NULL COMMENT '交易类型：earn-赚取，spend-花费，transfer-转账',
    amount DECIMAL(15,2) NOT NULL COMMENT '交易金额',
    balance_after DECIMAL(15,2) NOT NULL COMMENT '交易后余额',
    description TEXT COMMENT '交易描述',
    related_id BIGINT COMMENT '关联ID（如交易对象ID）',
    related_type VARCHAR(20) COMMENT '关联类型：agent-员工，company-公司，game-游戏',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='游戏币交易记录表';

-- 公司表
CREATE TABLE companies (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '公司名称',
    owner_id BIGINT NOT NULL COMMENT '所有者用户ID',
    description TEXT COMMENT '公司描述',
    logo_url VARCHAR(255) COMMENT '公司Logo URL',
    company_size INT DEFAULT 1 COMMENT '公司规模（员工数量上限）',
    max_employees INT DEFAULT 10 COMMENT '兼容字段：最大员工数量',
    workflow_type VARCHAR(20) DEFAULT 'linear' COMMENT '工作流程类型：linear-线性，feedback-反馈，concurrent-并发异步',
    workflow_config JSON COMMENT 'workflow参数（映射my-agent-test）',
    initial_capital DECIMAL(15,2) NOT NULL COMMENT '初始资金',
    current_capital DECIMAL(15,2) NOT NULL COMMENT '当前资金',
    status VARCHAR(20) DEFAULT 'active' COMMENT '状态：active-活跃，inactive-不活跃，bankrupt-破产',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id),
    INDEX idx_owner_id (owner_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公司表';

-- 公司员工关联表（支持合伙制）
CREATE TABLE company_partners (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    company_id BIGINT NOT NULL COMMENT '公司ID',
    user_id BIGINT NOT NULL COMMENT '合伙人用户ID',
    role VARCHAR(20) DEFAULT 'partner' COMMENT '角色：owner-所有者，partner-合伙人',
    profit_share_ratio DECIMAL(5,2) DEFAULT 0.00 COMMENT '利润分配比例',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY uk_company_user (company_id, user_id),
    INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公司合伙人表';

-- 员工Agent表
CREATE TABLE agents (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '员工名称',
    type VARCHAR(20) NOT NULL COMMENT '员工类型：planner-策划，artist-美术，developer-技术，tester-测试，music-音乐',
    dimension VARCHAR(10) COMMENT '维度：2d或3d（仅美术类型需要）',
    owner_id BIGINT NOT NULL COMMENT '所有者用户ID',
    company_id BIGINT COMMENT '所属公司ID',
    ai_model VARCHAR(50) COMMENT 'AI模型：DeepSeek-R1, GPT-5, Claude-Sonnet-4.5, DALL-E-3, Meshy-4等（为空时使用配置默认模型）',
    specialization VARCHAR(100) COMMENT '专业方向：策划=RPG/MOBA/SLG等，美术=realistic/cartoon/pixel等，技术=singleplayer/multiplayer等',
    extra_traits TEXT COMMENT '额外特点（影响提示词）：如"擅长C++性能优化"、"精通像素艺术风格"等',
    status VARCHAR(20) DEFAULT 'employed' COMMENT '状态：employed-在职，available-待业',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id),
    FOREIGN KEY (company_id) REFERENCES companies(id),
    INDEX idx_owner_id (owner_id),
    INDEX idx_company_id (company_id),
    INDEX idx_type (type),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='员工Agent表';

-- 游戏项目表
CREATE TABLE games (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '游戏名称',
    company_id BIGINT NOT NULL COMMENT '开发公司ID',
    genre VARCHAR(50) NOT NULL COMMENT '游戏类型：RPG，Strategy，Action，Puzzle等',
    description TEXT COMMENT '游戏描述',
    game_file_url VARCHAR(255) COMMENT '游戏文件URL（exe或zip包）',
    game_file_type VARCHAR(20) COMMENT '文件类型：exe，zip，web',
    version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
    development_status VARCHAR(20) DEFAULT 'developing' COMMENT '开发状态：developing-开发中，testing-测试中，released-已发布，archived-已归档',
    quality_score INT DEFAULT 0 COMMENT '质量评分：0-100',
    popularity_score INT DEFAULT 0 COMMENT '人气评分：0-100',
    downloads_count INT DEFAULT 0 COMMENT '下载次数',
    play_count INT DEFAULT 0 COMMENT '游玩次数',
    revenue DECIMAL(15,2) DEFAULT 0.00 COMMENT '收入',
    development_cost DECIMAL(15,2) DEFAULT 0.00 COMMENT '开发成本',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP NULL COMMENT '发布时间',
    FOREIGN KEY (company_id) REFERENCES companies(id),
    INDEX idx_company_id (company_id),
    INDEX idx_genre (genre),
    INDEX idx_status (development_status),
    INDEX idx_popularity (popularity_score DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='游戏项目表';

-- 游戏开发团队表
CREATE TABLE game_development_teams (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    game_id BIGINT NOT NULL COMMENT '游戏项目ID',
    agent_id BIGINT NOT NULL COMMENT '员工Agent ID',
    role VARCHAR(50) NOT NULL COMMENT '角色：lead-主策划，artist-美术，programmer-程序员，tester-测试等',
    contribution_score INT DEFAULT 0 COMMENT '贡献评分：0-100',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    UNIQUE KEY uk_game_agent (game_id, agent_id),
    INDEX idx_game_id (game_id),
    INDEX idx_agent_id (agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='游戏开发团队表';

-- 市场交易表
CREATE TABLE market_transactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    agent_id BIGINT NOT NULL COMMENT '员工Agent ID',
    seller_id BIGINT NOT NULL COMMENT '卖家用户ID',
    buyer_id BIGINT COMMENT '买家用户ID',
    transaction_type VARCHAR(20) NOT NULL COMMENT '交易类型：sell-出售，buy-购买',
    price DECIMAL(15,2) NOT NULL COMMENT '价格',
    status VARCHAR(20) DEFAULT 'active' COMMENT '状态：active-活跃，sold-已售出，cancelled-已取消',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sold_at TIMESTAMP NULL COMMENT '售出时间',
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (buyer_id) REFERENCES users(id),
    INDEX idx_agent_id (agent_id),
    INDEX idx_seller_id (seller_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='市场交易表';

-- 社区帖子表
CREATE TABLE community_posts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL COMMENT '帖子标题',
    content TEXT NOT NULL COMMENT '帖子内容',
    author_id BIGINT NOT NULL COMMENT '作者用户ID',
    post_type VARCHAR(20) DEFAULT 'discussion' COMMENT '帖子类型：discussion-讨论，guide-攻略，showcase-展示',
    related_game_id BIGINT COMMENT '相关游戏ID',
    related_company_id BIGINT COMMENT '相关公司ID',
    view_count INT DEFAULT 0 COMMENT '浏览次数',
    like_count INT DEFAULT 0 COMMENT '点赞次数',
    comment_count INT DEFAULT 0 COMMENT '评论次数',
    is_pinned BOOLEAN DEFAULT FALSE COMMENT '是否置顶',
    status TINYINT DEFAULT 1 COMMENT '状态：1-正常，0-隐藏',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (related_game_id) REFERENCES games(id),
    FOREIGN KEY (related_company_id) REFERENCES companies(id),
    INDEX idx_author_id (author_id),
    INDEX idx_type (post_type),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_popularity (like_count DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='社区帖子表';

-- 社区评论表
CREATE TABLE community_comments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL COMMENT '帖子ID',
    author_id BIGINT NOT NULL COMMENT '作者用户ID',
    content TEXT NOT NULL COMMENT '评论内容',
    parent_id BIGINT COMMENT '父评论ID（支持嵌套评论）',
    like_count INT DEFAULT 0 COMMENT '点赞次数',
    status TINYINT DEFAULT 1 COMMENT '状态：1-正常，0-隐藏',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES community_posts(id),
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES community_comments(id),
    INDEX idx_post_id (post_id),
    INDEX idx_author_id (author_id),
    INDEX idx_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='社区评论表';

-- 系统配置表
CREATE TABLE system_configs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) UNIQUE NOT NULL COMMENT '配置键',
    config_value TEXT COMMENT '配置值',
    description TEXT COMMENT '配置描述',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- 插入默认系统配置
INSERT INTO system_configs (config_key, config_value, description) VALUES
('company_creation_cost', '5000.00', '创建公司所需游戏币'),
('agent_creation_cost', '1000.00', '创建员工Agent所需游戏币'),
('market_transaction_fee_rate', '0.05', '市场交易手续费率'),
('company_initial_size', '5', '公司初始员工数量上限'),
('agent_salary_base', '1000.00', '员工基础薪资'),
('game_development_base_cost', '5000.00', '游戏开发基础成本');