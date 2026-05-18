#!/usr/bin/env bash
# =============================================================================
# Access Bank — CDC Per-Row Latency Analysis
# =============================================================================
# Queries ora_enriched_transactions for per-row latency breakdown using:
#   - ora_created_at:     Oracle SAVE_TIMESTAMP (when row was committed in Oracle)
#   - kafka_published_at: Kafka broker timestamp (when Debezium message hit Kafka)
#   - created_at:         Postgres insert time (when Synapse wrote to PG)
#
# Produces:
#   1. Summary statistics (percentiles per stage)
#   2. CSV export of per-row latencies
#
# Usage:
#   ./load-tests/scripts/cdc-latency-analysis.sh [minutes_back] [env_file]
#   ./load-tests/scripts/cdc-latency-analysis.sh 30
#   ./load-tests/scripts/cdc-latency-analysis.sh 60 load-tests/envs/dev.env
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MINUTES_BACK="${1:-30}"
ENV_FILE="${2:-load-tests/envs/dev.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-15432}"
PG_DB="${PG_DB:-synapse}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-}"

REPORT_DIR="load-tests/reports"
mkdir -p "$REPORT_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
CSV_FILE="$REPORT_DIR/latency-per-row-${TIMESTAMP}.csv"
SUMMARY_FILE="$REPORT_DIR/latency-summary-${TIMESTAMP}.txt"

export PGPASSWORD="$PG_PASSWORD"
PG="psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DB"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# ---------------------------------------------------------------------------
# Summary statistics
# ---------------------------------------------------------------------------
log "CDC Latency Analysis — last ${MINUTES_BACK} minutes"
log "Postgres: ${PG_HOST}:${PG_PORT}/${PG_DB}"
log ""

SUMMARY=$($PG -t -A -F'|' -c "
SELECT
  COUNT(*) AS total_records,
  COUNT(*) FILTER (WHERE ora_created_at IS NOT NULL AND kafka_published_at IS NOT NULL) AS with_timestamps,
  -- Capture lag: Kafka - Oracle (Debezium + LogMiner)
  ROUND(EXTRACT(EPOCH FROM PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY kafka_published_at - ora_created_at))::numeric, 3) AS capture_p50_sec,
  ROUND(EXTRACT(EPOCH FROM PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY kafka_published_at - ora_created_at))::numeric, 3) AS capture_p90_sec,
  ROUND(EXTRACT(EPOCH FROM PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY kafka_published_at - ora_created_at))::numeric, 3) AS capture_p95_sec,
  ROUND(EXTRACT(EPOCH FROM PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY kafka_published_at - ora_created_at))::numeric, 3) AS capture_p99_sec,
  ROUND(EXTRACT(EPOCH FROM MAX(kafka_published_at - ora_created_at))::numeric, 3) AS capture_max_sec,
  -- Consumer lag: Postgres - Kafka (Synapse processing)
  ROUND(EXTRACT(EPOCH FROM PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY created_at - kafka_published_at))::numeric, 3) AS consumer_p50_sec,
  ROUND(EXTRACT(EPOCH FROM PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY created_at - kafka_published_at))::numeric, 3) AS consumer_p90_sec,
  ROUND(EXTRACT(EPOCH FROM PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY created_at - kafka_published_at))::numeric, 3) AS consumer_p95_sec,
  ROUND(EXTRACT(EPOCH FROM PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY created_at - kafka_published_at))::numeric, 3) AS consumer_p99_sec,
  ROUND(EXTRACT(EPOCH FROM MAX(created_at - kafka_published_at))::numeric, 3) AS consumer_max_sec,
  -- Total E2E: Postgres - Oracle
  ROUND(EXTRACT(EPOCH FROM PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY created_at - ora_created_at))::numeric, 3) AS e2e_p50_sec,
  ROUND(EXTRACT(EPOCH FROM PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY created_at - ora_created_at))::numeric, 3) AS e2e_p90_sec,
  ROUND(EXTRACT(EPOCH FROM PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY created_at - ora_created_at))::numeric, 3) AS e2e_p95_sec,
  ROUND(EXTRACT(EPOCH FROM PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY created_at - ora_created_at))::numeric, 3) AS e2e_p99_sec,
  ROUND(EXTRACT(EPOCH FROM MAX(created_at - ora_created_at))::numeric, 3) AS e2e_max_sec
FROM ora_enriched_transactions
WHERE ora_created_at IS NOT NULL
  AND kafka_published_at IS NOT NULL
  AND created_at >= NOW() - INTERVAL '${MINUTES_BACK} minutes';
")

IFS='|' read -r TOTAL WITH_TS \
  CAP_P50 CAP_P90 CAP_P95 CAP_P99 CAP_MAX \
  CON_P50 CON_P90 CON_P95 CON_P99 CON_MAX \
  E2E_P50 E2E_P90 E2E_P95 E2E_P99 E2E_MAX <<< "$SUMMARY"

{
  echo "═══════════════════════════════════════════════════════════════"
  echo "  Access Bank CDC Pipeline — Latency Report"
  echo "  Generated: $(date)"
  echo "  Window: last ${MINUTES_BACK} minutes"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "  Records analyzed: $TOTAL (with timestamps: $WITH_TS)"
  echo ""
  echo "  ┌────────────────────┬─────────┬─────────┬─────────┬─────────┬─────────┐"
  echo "  │ Stage              │  p50    │  p90    │  p95    │  p99    │  max    │"
  echo "  ├────────────────────┼─────────┼─────────┼─────────┼─────────┼─────────┤"
  printf "  │ Capture (Ora→Kfk)  │ %6ss │ %6ss │ %6ss │ %6ss │ %6ss │\n" "$CAP_P50" "$CAP_P90" "$CAP_P95" "$CAP_P99" "$CAP_MAX"
  printf "  │ Consumer (Kfk→PG)  │ %6ss │ %6ss │ %6ss │ %6ss │ %6ss │\n" "$CON_P50" "$CON_P90" "$CON_P95" "$CON_P99" "$CON_MAX"
  printf "  │ Total E2E (Ora→PG) │ %6ss │ %6ss │ %6ss │ %6ss │ %6ss │\n" "$E2E_P50" "$E2E_P90" "$E2E_P95" "$E2E_P99" "$E2E_MAX"
  echo "  └────────────────────┴─────────┴─────────┴─────────┴─────────┴─────────┘"
  echo ""
} | tee "$SUMMARY_FILE"

# ---------------------------------------------------------------------------
# Per-row CSV export
# ---------------------------------------------------------------------------
log "Exporting per-row latencies to $CSV_FILE..."

$PG -c "COPY (
  SELECT
    ac_entry_sr_no,
    ac_no,
    trn_ref_no,
    ora_created_at,
    kafka_published_at,
    created_at,
    ROUND(EXTRACT(EPOCH FROM kafka_published_at - ora_created_at)::numeric, 3) AS capture_lag_sec,
    ROUND(EXTRACT(EPOCH FROM created_at - kafka_published_at)::numeric, 3) AS consumer_lag_sec,
    ROUND(EXTRACT(EPOCH FROM created_at - ora_created_at)::numeric, 3) AS total_e2e_sec
  FROM ora_enriched_transactions
  WHERE ora_created_at IS NOT NULL
    AND kafka_published_at IS NOT NULL
    AND created_at >= NOW() - INTERVAL '${MINUTES_BACK} minutes'
  ORDER BY ora_created_at
) TO STDOUT WITH CSV HEADER" > "$CSV_FILE"

ROW_COUNT=$(wc -l < "$CSV_FILE")
log "Exported $((ROW_COUNT - 1)) rows to $CSV_FILE"
log "Summary: $SUMMARY_FILE"
