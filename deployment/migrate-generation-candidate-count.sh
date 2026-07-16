#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
DEPLOYMENT_DIR="${MYKINLEGACY_DEPLOYMENT_DIR:-$SCRIPT_DIR}"
ENV_FILE="$DEPLOYMENT_DIR/.env.production"
COMPOSE_FILE="$DEPLOYMENT_DIR/docker-compose.yml"
COMPOSE_PROJECT_NAME="mykinlegacy"
BACKUP_DIR="$DEPLOYMENT_DIR/backups/generation-config"
MODE="${1:---inspect}"

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL deployment/.env.production is missing"
  exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

compose() {
  $SUDO docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

run_node() {
  compose run --rm --no-deps -T api node -
}

snapshot() {
  run_node <<'NODE'
const { PrismaClient } = require("./packages/database/generated/client");
const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.productPackage.findMany({
    select: { id: true, productId: true, code: true, generationConfigJson: true },
    orderBy: { id: "asc" }
  });
  console.log(JSON.stringify({
    schema_version: 1,
    created_at: new Date().toISOString(),
    records: rows.map((row) => ({
      id: row.id,
      product_id: row.productId,
      package_code: row.code,
      generation_config_json: row.generationConfigJson
    }))
  }, null, 2));
})().finally(() => prisma.$disconnect());
NODE
}

inspect() {
  run_node <<'NODE'
const { PrismaClient } = require("./packages/database/generated/client");
const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.productPackage.findMany({
    select: { id: true, generationConfigJson: true }
  });
  const result = rows.map((row) => {
    const config = row.generationConfigJson && typeof row.generationConfigJson === "object" && !Array.isArray(row.generationConfigJson)
      ? row.generationConfigJson
      : {};
    const hasOld = Object.prototype.hasOwnProperty.call(config, "image_count");
    const hasNew = Object.prototype.hasOwnProperty.call(config, "generation_candidate_count");
    return {
      id: row.id,
      has_image_count: hasOld,
      image_count: hasOld ? config.image_count : null,
      has_generation_candidate_count: hasNew,
      generation_candidate_count: hasNew ? config.generation_candidate_count : null,
      conflict: hasOld && hasNew && config.image_count !== config.generation_candidate_count
    };
  });
  console.log(JSON.stringify({
    records_inspected: result.length,
    records_with_image_count: result.filter((row) => row.has_image_count).length,
    records_with_generation_candidate_count: result.filter((row) => row.has_generation_candidate_count).length,
    conflicts: result.filter((row) => row.conflict).length,
    records: result
  }, null, 2));
})().finally(() => prisma.$disconnect());
NODE
}

apply_migration() {
  run_node <<'NODE'
const { PrismaClient } = require("./packages/database/generated/client");
const prisma = new PrismaClient();

(async () => {
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.productPackage.findMany({
      select: { id: true, generationConfigJson: true }
    });
    const conflicts = [];
    const candidates = [];

    for (const row of rows) {
      const config = row.generationConfigJson && typeof row.generationConfigJson === "object" && !Array.isArray(row.generationConfigJson)
        ? { ...row.generationConfigJson }
        : {};
      const hasOld = Object.prototype.hasOwnProperty.call(config, "image_count");
      const hasNew = Object.prototype.hasOwnProperty.call(config, "generation_candidate_count");
      if (hasOld && hasNew && config.image_count !== config.generation_candidate_count) {
        conflicts.push(row.id);
      } else if (hasOld) {
        candidates.push({ row, config, hasNew });
      }
    }

    if (conflicts.length > 0) {
      throw new Error(`generation_candidate_field_conflict:${conflicts.join(",")}`);
    }

    for (const candidate of candidates) {
      if (!candidate.hasNew) {
        candidate.config.generation_candidate_count = candidate.config.image_count;
      }
      delete candidate.config.image_count;
      await tx.productPackage.update({
        where: { id: candidate.row.id },
        data: { generationConfigJson: candidate.config }
      });
    }

    return {
      records_inspected: rows.length,
      records_migrated: candidates.length,
      conflicts: conflicts.length
    };
  });
  console.log(JSON.stringify(result));
})().finally(() => prisma.$disconnect());
NODE
}

rollback() {
  local backup_file="$1"
  local resolved_backup
  resolved_backup="$(realpath "$backup_file")"
  case "$resolved_backup" in
    "$(realpath "$BACKUP_DIR")"/*) ;;
    *) echo "FAIL rollback backup must be inside $BACKUP_DIR"; exit 1 ;;
  esac

  compose run --rm --no-deps -T api node -e '
const fs = require("node:fs");
const { PrismaClient } = require("./packages/database/generated/client");
const prisma = new PrismaClient();
(async () => {
  const backup = JSON.parse(fs.readFileSync(0, "utf8"));
  if (backup.schema_version !== 1 || !Array.isArray(backup.records)) throw new Error("invalid_generation_config_backup");
  await prisma.$transaction(async (tx) => {
    for (const record of backup.records) {
      await tx.productPackage.update({
        where: { id: record.id },
        data: { generationConfigJson: record.generation_config_json }
      });
    }
  });
  console.log(JSON.stringify({ records_restored: backup.records.length }));
})().finally(() => prisma.$disconnect());
' < "$resolved_backup"
}

case "$MODE" in
  --inspect)
    inspect
    ;;
  --apply)
    if [ "${MYKINLEGACY_LOCK_HELD:-false}" != "true" ]; then
      exec bash "$DEPLOYMENT_DIR/with-production-lock.sh" "generation-candidate-field-migration" bash "$SCRIPT_PATH" --apply
    fi
    mkdir -p "$BACKUP_DIR"
    chmod 700 "$BACKUP_DIR"
    backup_file="$BACKUP_DIR/product-package-generation-config-$(date -u '+%Y%m%dT%H%M%SZ').json"
    temp_file="${backup_file}.tmp"
    snapshot > "$temp_file"
    chmod 600 "$temp_file"
    compose run --rm --no-deps -T api node -e 'JSON.parse(require("node:fs").readFileSync(0, "utf8"));' < "$temp_file"
    mv "$temp_file" "$backup_file"
    echo "Backup created: $backup_file"
    apply_migration
    inspect
    ;;
  --rollback)
    if [ $# -ne 2 ]; then
      echo "Usage: bash deployment/migrate-generation-candidate-count.sh --rollback <backup-file>"
      exit 1
    fi
    if [ "${MYKINLEGACY_LOCK_HELD:-false}" != "true" ]; then
      exec bash "$DEPLOYMENT_DIR/with-production-lock.sh" "generation-candidate-field-rollback" bash "$SCRIPT_PATH" --rollback "$2"
    fi
    rollback "$2"
    inspect
    ;;
  *)
    echo "Usage: bash deployment/migrate-generation-candidate-count.sh [--inspect|--apply|--rollback <backup-file>]"
    exit 1
    ;;
esac
