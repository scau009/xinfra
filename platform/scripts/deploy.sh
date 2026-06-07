#!/bin/bash
set -e

REPO_DIR="/opt/plat/repo"
ENV_DIR="/opt/plat"             # .env lives here (secrets, NOT in repo)
COMPOSE_FILE="$REPO_DIR/platform/docker-compose.prod.yml"

# === Pull latest code ===
echo "[deploy] pulling latest code..."
cd "$REPO_DIR"
git pull origin main

IMAGE_TAG=$(git rev-parse --short=7 HEAD)
echo "[deploy] commit: $IMAGE_TAG"

# === Load registry config ===
set -a
source "$ENV_DIR/.env"
set +a

REGISTRY_BASE="${REGISTRY_URL}/${REGISTRY_NAMESPACE}"

# === Build & push ===
for service in api-server build-runner deploy-scheduler web; do
  IMAGE="plat-${service}"
  echo "[deploy] building $IMAGE..."
  docker build \
    -t "$REGISTRY_BASE/$IMAGE:$IMAGE_TAG" \
    -t "$REGISTRY_BASE/$IMAGE:latest" \
    "$REPO_DIR/platform/$service"

  echo "[deploy] pushing $IMAGE..."
  docker push "$REGISTRY_BASE/$IMAGE:$IMAGE_TAG"
  docker push "$REGISTRY_BASE/$IMAGE:latest"
done

# === Deploy ===
cd "$ENV_DIR"
cat > .env.ci << EOF
REGISTRY_URL=${REGISTRY_URL}
REGISTRY_NAMESPACE=${REGISTRY_NAMESPACE}
EOF
docker compose -f "$COMPOSE_FILE" --env-file .env --env-file .env.ci pull
docker compose -f "$COMPOSE_FILE" --env-file .env --env-file .env.ci up -d --remove-orphans
rm -f .env.ci
docker image prune -f

echo "[deploy] done — $IMAGE_TAG"
