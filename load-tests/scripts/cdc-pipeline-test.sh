#!/usr/bin/env bash
# =============================================================================
# Access Bank — CDC Pipeline Latency Test
# =============================================================================
# Measures end-to-end latency: Oracle INSERT → Debezium → Kafka → Synapse → Postgres
#
# Prerequisites:
#   - Oracle port-forwarded:  kubectl -n access-cdc port-forward svc/oracle-xe 11521:1521
#   - Postgres port-forwarded: kubectl -n access port-forward svc/access-db-cluster-rw 15432:5432
#   - sqlplus installed (or use DBeaver to run Oracle SQL manually)
#   - psql installed
#
# Usage:
#   ./load-tests/scripts/cdc-pipeline-test.sh [batch_size] [env_file]
#   ./load-tests/scripts/cdc-pipeline-test.sh 1000 load-tests/envs/dev.env
#   ./load-tests/scripts/cdc-pipeline-test.sh 10000
#
# Batch progression (if no batch_size given):
#   Runs 1000 → 10000 → 100000 sequentially
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Load environment config
# ---------------------------------------------------------------------------
ENV_FILE="${2:-load-tests/envs/dev.env}"
if [[ -f "$ENV_FILE" ]]; then
  echo "[config] Loading environment from $ENV_FILE"
  set -a
  source "$ENV_FILE"
  set +a
fi

# Defaults (can be overridden by env file)
ORACLE_HOST="${ORACLE_HOST:-localhost}"
ORACLE_PORT="${ORACLE_PORT:-11521}"
ORACLE_SERVICE="${ORACLE_SERVICE:-ACCESSBANK}"
ORACLE_USER="${ORACLE_USER:-C##DEBEZIUM}"
ORACLE_PASSWORD="${ORACLE_PASSWORD:-H2c5xq3QufELaoBaYl3KJnrz}"

PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-15432}"
PG_DB="${PG_DB:-synapse}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-}"

REPORT_DIR="load-tests/reports"
mkdir -p "$REPORT_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_FILE="$REPORT_DIR/cdc-pipeline-${TIMESTAMP}.csv"
SUMMARY_FILE="$REPORT_DIR/cdc-pipeline-${TIMESTAMP}-summary.txt"

# ---------------------------------------------------------------------------
# Connection strings
# ---------------------------------------------------------------------------
ORACLE_CONN="${ORACLE_USER}/${ORACLE_PASSWORD}@//${ORACLE_HOST}:${ORACLE_PORT}/${ORACLE_SERVICE}"
export PGPASSWORD="$PG_PASSWORD"
PG_CONN="psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DB -t -A"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log() { echo "[$(date '+%H:%M:%S')] $*"; }

pg_count() {
  $PG_CONN -c "SELECT COUNT(*) FROM ora_enriched_transactions;" 2>/dev/null | tr -d ' '
}

pg_latency_stats() {
  $PG_CONN -c "
    SELECT
      COUNT(*) AS total_records,
      ROUND(EXTRACT(EPOCH FROM AVG(created_at - oracle_timestamp))::numeric, 3) AS avg_latency_sec,
      ROUND(EXTRACT(EPOCH FROM PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY created_at - oracle_timestamp))::numeric, 3) AS p50_sec,
      ROUND(EXTRACT(EPOCH FROM PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY created_at - oracle_timestamp))::numeric, 3) AS p95_sec,
      ROUND(EXTRACT(EPOCH FROM PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY created_at - oracle_timestamp))::numeric, 3) AS p99_sec,
      ROUND(EXTRACT(EPOCH FROM MAX(created_at - oracle_timestamp))::numeric, 3) AS max_latency_sec,
      ROUND(EXTRACT(EPOCH FROM MIN(created_at - oracle_timestamp))::numeric, 3) AS min_latency_sec
    FROM ora_enriched_transactions
    WHERE created_at >= NOW() - INTERVAL '30 minutes';
  " 2>/dev/null
}

# ---------------------------------------------------------------------------
# Run a single batch test
# ---------------------------------------------------------------------------
run_batch() {
  local BATCH_SIZE=$1
  log "=========================================="
  log "BATCH TEST: $BATCH_SIZE transactions"
  log "=========================================="

  # Step 1: Record baseline count in Postgres
  local PG_BEFORE
  PG_BEFORE=$(pg_count)
  log "Postgres baseline count: $PG_BEFORE"

  # Step 2: Record start time
  local START_TIME
  START_TIME=$(date +%s.%N)
  log "Generating $BATCH_SIZE transactions in Oracle..."

  # Step 3: Generate transactions in Oracle
  sqlplus -S "$ORACLE_CONN" <<EOF
SET SERVEROUTPUT ON SIZE UNLIMITED
SET FEEDBACK OFF
BEGIN
  GENERATE_CDC_TRANSACTIONS($BATCH_SIZE);
END;
/
EXIT;
EOF

  local ORACLE_DONE_TIME
  ORACLE_DONE_TIME=$(date +%s.%N)
  local ORACLE_DURATION
  ORACLE_DURATION=$(echo "$ORACLE_DONE_TIME - $START_TIME" | bc)
  log "Oracle INSERT completed in ${ORACLE_DURATION}s"

  # Step 4: Poll Postgres until all records arrive or timeout
  local EXPECTED=$((PG_BEFORE + BATCH_SIZE))
  local TIMEOUT=600  # 10 minutes max wait
  local POLL_INTERVAL=5
  local ELAPSED=0
  local CURRENT_COUNT

  log "Waiting for Postgres to reach $EXPECTED records (timeout: ${TIMEOUT}s)..."

  while [[ $ELAPSED -lt $TIMEOUT ]]; do
    CURRENT_COUNT=$(pg_count)
    local ARRIVED=$((CURRENT_COUNT - PG_BEFORE))
    local PCT=0
    if [[ $BATCH_SIZE -gt 0 ]]; then
      PCT=$((ARRIVED * 100 / BATCH_SIZE))
    fi

    if [[ $CURRENT_COUNT -ge $EXPECTED ]]; then
      local END_TIME
      END_TIME=$(date +%s.%N)
      local TOTAL_DURATION
      TOTAL_DURATION=$(echo "$END_TIME - $START_TIME" | bc)
      local PIPELINE_DURATION
      PIPELINE_DURATION=$(echo "$END_TIME - $ORACLE_DONE_TIME" | bc)
      local TPS
      TPS=$(echo "scale=2; $BATCH_SIZE / $TOTAL_DURATION" | bc)
      local PIPELINE_TPS
      PIPELINE_TPS=$(echo "scale=2; $BATCH_SIZE / $PIPELINE_DURATION" | bc)

      log "ALL $BATCH_SIZE records arrived in Postgres!"
      log "  Oracle INSERT time:     ${ORACLE_DURATION}s"
      log "  Pipeline delivery time: ${PIPELINE_DURATION}s"
      log "  Total end-to-end time:  ${TOTAL_DURATION}s"
      log "  Overall TPS:            ${TPS} txn/s"
      log "  Pipeline TPS:           ${PIPELINE_TPS} txn/s"

      # Write CSV row
      echo "$BATCH_SIZE,$ORACLE_DURATION,$PIPELINE_DURATION,$TOTAL_DURATION,$TPS,$PIPELINE_TPS" >> "$REPORT_FILE"
      return 0
    fi

    log "  Progress: $ARRIVED / $BATCH_SIZE ($PCT%) — elapsed ${ELAPSED}s"
    sleep $POLL_INTERVAL
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
  done

  # Timeout
  CURRENT_COUNT=$(pg_count)
  local ARRIVED=$((CURRENT_COUNT - PG_BEFORE))
  log "TIMEOUT after ${TIMEOUT}s. Only $ARRIVED / $BATCH_SIZE records arrived."
  echo "$BATCH_SIZE,$ORACLE_DURATION,TIMEOUT,TIMEOUT,0,0" >> "$REPORT_FILE"
  return 1
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  log "Access Bank CDC Pipeline Latency Test"
  log "Oracle: ${ORACLE_HOST}:${ORACLE_PORT}/${ORACLE_SERVICE}"
  log "Postgres: ${PG_HOST}:${PG_PORT}/${PG_DB}"
  log ""

  # CSV header
  echo "batch_size,oracle_insert_sec,pipeline_delivery_sec,total_e2e_sec,overall_tps,pipeline_tps" > "$REPORT_FILE"

  # Determine batch sizes
  if [[ -n "${1:-}" ]]; then
    BATCHES=("$1")
  else
    BATCHES=(1000 10000 100000)
  fi

  for BATCH in "${BATCHES[@]}"; do
    run_batch "$BATCH"
    log ""
    # Pause between batches to let pipeline settle
    if [[ ${#BATCHES[@]} -gt 1 ]]; then
      log "Pausing 30s before next batch..."
      sleep 30
    fi
  done

  # ---------------------------------------------------------------------------
  # Summary
  # ---------------------------------------------------------------------------
  log "=========================================="
  log "PIPELINE TEST COMPLETE"
  log "=========================================="
  log ""
  log "Results CSV: $REPORT_FILE"
  cat "$REPORT_FILE"
  log ""

  # Latency stats from Postgres
  log "Latency statistics (last 30 min):"
  pg_latency_stats

  # Write summary
  {
    echo "Access Bank CDC Pipeline Test — $(date)"
    echo "=========================================="
    echo ""
    echo "Environment: $ENV_FILE"
    echo "Oracle: ${ORACLE_HOST}:${ORACLE_PORT}/${ORACLE_SERVICE}"
    echo "Postgres: ${PG_HOST}:${PG_PORT}/${PG_DB}"
    echo ""
    echo "Results:"
    cat "$REPORT_FILE"
    echo ""
    echo "Latency Stats (last 30 min):"
    pg_latency_stats
  } > "$SUMMARY_FILE"

  log "Summary: $SUMMARY_FILE"
}

main "$@"
