#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Multi-node deployment helper (Docker + remote hosts)
# Each section uses placeholders (TODO_*) that must be replaced before use.
# This script assumes passwordless SSH is configured for all target hosts.
# ============================================================================

# ---- Global configuration --------------------------------------------------
MGMT_NODE="TODO_MGMT_IP"
GF_BACKEND_NODE="TODO_GAME_FACTORY_BACKEND_IP"
GF_FRONTEND_NODE="TODO_GAME_FACTORY_FRONTEND_IP"
MY_AGENT_API_NODE="TODO_MY_AGENT_API_IP"
MY_AGENT_CONSUMER_NODE="TODO_MY_AGENT_CONSUMER_IP"
PLAN_AGENT_NODE="TODO_PLANNING_AGENT_IP"
ART_AGENT_NODE="TODO_ART_AGENT_IP"
MUSIC_AGENT_NODE="TODO_MUSIC_AGENT_IP"
TECH_AGENT_NODE="TODO_TECH_AGENT_IP"
TEST_AGENT_NODE="TODO_TEST_AGENT_IP"
REDIS_NODE="TODO_REDIS_IP"
MYSQL_NODE="TODO_MYSQL_IP"
KAFKA_NODE="TODO_KAFKA_BROKER_IP"

# Docker registry (Aliyun ACR or GCR)
REGISTRY_URL="TODO_REGISTRY_URL"
REGISTRY_USER="TODO_REGISTRY_USER"
REGISTRY_PASS="TODO_REGISTRY_PASS"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Helper to run remote commands via SSH
remote_exec() {
  local host="$1"; shift
  ssh "root@${host}" "$@"
}

# Helper to copy files
remote_copy() {
  local src="$1"; local host="$2"; local dst="$3"
  scp "$src" "root@${host}:${dst}"
}

# ---- 1. Build & push docker images ----------------------------------------
echo ">> Building docker images"
docker login "${REGISTRY_URL}" -u "${REGISTRY_USER}" -p "${REGISTRY_PASS}"

build_push () {
  local name="$1"; local dockerfile="$2"; local context="$3"
  docker build -t "${REGISTRY_URL}/${name}:${IMAGE_TAG}" -f "$dockerfile" "$context"
  docker push "${REGISTRY_URL}/${name}:${IMAGE_TAG}"
}

# Game Factory services
build_push "game-factory-backend" "backend/Dockerfile" "game-factory/backend"
build_push "game-factory-frontend" "frontend/Dockerfile" "game-factory/frontend"

# my-agent-test services
build_push "my-agent-api" "my-agent-test/Dockerfile" "my-agent-test"
build_push "my-agent-consumer" "my-agent-test/deploy/workers/Dockerfile" "my-agent-test"
build_push "planning-agent" "my-agent-test/src/agents/planning/Dockerfile" "my-agent-test"
build_push "art-agent" "my-agent-test/src/agents/art/Dockerfile" "my-agent-test"
build_push "music-agent" "my-agent-test/src/agents/music/Dockerfile" "my-agent-test"
build_push "tech-agent" "my-agent-test/src/agents/tech/Dockerfile" "my-agent-test"
build_push "test-agent" "my-agent-test/src/agents/test/Dockerfile" "my-agent-test"

# ---- 2. Deploy infrastructural services -----------------------------------
# These commands assume Docker Engine is installed on target hosts.

deploy_redis() {
  remote_exec "${REDIS_NODE}" "docker run -d --restart=always --name redis \
    -p 6379:6379 redis:7-alpine --requirepass TODO_REDIS_PASSWORD"
}

deploy_mysql() {
  remote_exec "${MYSQL_NODE}" "docker run -d --restart=always --name mysql \
    -e MYSQL_ROOT_PASSWORD=TODO_MYSQL_ROOT_PASSWORD \
    -e MYSQL_DATABASE=game_platform \
    -p 3306:3306 mysql:8"
}

deploy_kafka() {
  remote_exec "${KAFKA_NODE}" "
    docker network create kafka-net || true
    docker run -d --restart=always --name zookeeper --network kafka-net \
      -e ZOOKEEPER_CLIENT_PORT=2181 confluentinc/cp-zookeeper:7.6.0
    docker run -d --restart=always --name kafka --network kafka-net \
      -p 9092:9092 \
      -e KAFKA_BROKER_ID=1 \
      -e KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181 \
      -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://${KAFKA_NODE}:9092 \
      -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
      confluentinc/cp-kafka:7.6.0"
}

# ---- 3. Deploy application services ---------------------------------------
deploy_service() {
  local host="$1"; local name="$2"; local env_file="$3"; local port_map="$4"
  remote_copy "$env_file" "$host" "/opt/${name}/.env"
  remote_exec "$host" "
    mkdir -p /opt/${name}
    docker rm -f ${name} || true
    docker run -d --restart=always --name ${name} \
      --env-file /opt/${name}/.env \
      -p ${port_map} \
      ${REGISTRY_URL}/${name}:${IMAGE_TAG}
  "
}

# Game Factory backend & frontend
deploy_service "${GF_BACKEND_NODE}" "game-factory-backend" "deploy/envs/gf-backend.env" "3000:3000"
deploy_service "${GF_FRONTEND_NODE}" "game-factory-frontend" "deploy/envs/gf-frontend.env" "3001:80"

# my-agent-test API & consumer
deploy_service "${MY_AGENT_API_NODE}" "my-agent-api" "deploy/envs/my-agent-api.env" "8080:8080"
deploy_service "${MY_AGENT_CONSUMER_NODE}" "my-agent-consumer" "deploy/envs/my-agent-consumer.env" "0:0"

# Individual agents
deploy_service "${PLAN_AGENT_NODE}" "planning-agent" "deploy/envs/planning-agent.env" "0:0"
deploy_service "${ART_AGENT_NODE}" "art-agent" "deploy/envs/art-agent.env" "0:0"
deploy_service "${MUSIC_AGENT_NODE}" "music-agent" "deploy/envs/music-agent.env" "0:0"
deploy_service "${TECH_AGENT_NODE}" "tech-agent" "deploy/envs/tech-agent.env" "0:0"
deploy_service "${TEST_AGENT_NODE}" "test-agent" "deploy/envs/test-agent.env" "0:0"

# ---- 4. Capacity planning (10000 concurrent users) ------------------------
# Recommended instance types (fill in actual SKUs/prices for Aliyun/GCP).
#  * Game Factory backend: 2 × 4vCPU / 8GB
#  * Game Factory frontend: 1 × 2vCPU / 4GB
#  * my-agent API: 2 × 8vCPU / 16GB
#  * Workflow consumer: 2 × 4vCPU / 8GB
#  * Planning agent: 1 × 4vCPU / 16GB
#  * Art agent: 1 × 8vCPU / 32GB (+ GPU if可用)
#  * Music agent: 1 × 8vCPU / 16GB
#  * Tech agent: 1 × 4vCPU / 16GB
#  * Test agent: 1 × 4vCPU / 8GB
#  * Redis: 1 × 2vCPU / 4GB
#  * Kafka: 3 brokers × 4vCPU / 8GB（跨AZ）
#  * MySQL: 1 primary 8vCPU / 16GB + 1 replica 8vCPU / 16GB
#  * 预计成本（占位）：Aliyun ¥XX,XXX/月，GCP $X,XXX/月（请按实际区域/计费替换）。

echo "Deployment script completed. Please verify all services are running."

