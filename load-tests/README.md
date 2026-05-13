# Access Bank CDC — Load Tests & Performance Reports

Load testing and PDF report generation for the CDC pipeline (Oracle → Debezium → Kafka → Synapse → PostgreSQL).

## Directory Structure

```
load-tests/
├── scripts/
│   ├── api-load-test.js                  # k6 — API endpoint load test
│   ├── cdc-pipeline-test.sh              # Shell — CDC pipeline latency test
│   ├── monitor-resources.ps1             # PowerShell — single-snapshot resource monitor
│   ├── monitor-resources-multi.ps1       # PowerShell — continuous resource monitor
│   ├── extract-reports.ps1               # PowerShell — extract k6 reports
│   ├── generate-final-report.js          # PDF — final 100K performance report (3-page)
│   ├── generate-100k-clean-report.js     # PDF — 100K clean-slate test report
│   ├── generate-100k-tuned-report.js     # PDF — 100K post-tuning report
│   ├── generate-100k-performance-report.js # PDF — 100K defaults report
│   ├── generate-cdc-pipeline-report.js   # PDF — 1M test report
│   └── generate-pdf-report.js            # PDF — API load test report
├── envs/
│   ├── dev.env                           # Dev environment config (gitignored)
│   ├── in-cluster.env                    # In-cluster K8s config (gitignored)
│   └── staging.env.template              # Template for new environments
├── k8s/
│   └── k6-job.yaml                       # Kubernetes Job for in-cluster test
├── reports/                              # Generated output (gitignored)
│   ├── cdc-pipeline/                     # PDF reports
│   └── *.csv, *.html, *.json             # Raw data
└── package.json
```

---

## Setup

### 1. Install dependencies

```bash
cd load-tests
npm install
```

### 2. Port-forwards (for local execution)

```bash
# Terminal 1 — Oracle
AWS_PROFILE=fiter kubectl -n access-cdc port-forward svc/oracle-xe 11521:1521

# Terminal 2 — PostgreSQL
AWS_PROFILE=fiter kubectl -n access port-forward svc/access-db-cluster-rw 15432:5432
```

### 3. Environment config

Copy the template and fill in credentials:

```bash
cp envs/staging.env.template envs/staging.env
# Edit envs/staging.env with your values
```

---

## Running CDC Pipeline Tests

### Automated (shell script)

```bash
# 1,000 transactions
./scripts/cdc-pipeline-test.sh 1000

# 10,000 transactions
./scripts/cdc-pipeline-test.sh 10000

# 100,000 transactions
./scripts/cdc-pipeline-test.sh 100000

# Progressive: 1K → 10K → 100K
./scripts/cdc-pipeline-test.sh

# With explicit env file
./scripts/cdc-pipeline-test.sh 100000 envs/dev.env
```

### Manual (kubectl + psql)

If `sqlplus` is not available, run the test manually:

**Step 1 — Record baseline count:**

```sql
-- PostgreSQL
SELECT COUNT(*) FROM ora_enriched_transactions;
```

**Step 2 — Insert test records in Oracle:**

```bash
AWS_PROFILE=fiter kubectl -n access-cdc exec -it oracle-xe-0 -c oracle -- bash -c "
  sqlplus C##DEBEZIUM/PASSWORD@//localhost:1521/ACCESSBANK <<'SQL'
    SET TIMING ON
    BEGIN GENERATE_CDC_TRANSACTIONS(100000); END;
    /
SQL"
```

**Step 3 — Poll PostgreSQL until all records arrive:**

```sql
-- Repeat until count increases by 100,000
SELECT COUNT(*) FROM ora_enriched_transactions;
```

**Step 4 — Check latency stats:**

```sql
SELECT
  COUNT(*) AS total,
  ROUND(AVG(EXTRACT(EPOCH FROM (created_at - oracle_timestamp)))::numeric, 1) AS avg_sec,
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (created_at - oracle_timestamp)))::numeric, 1) AS p50,
  ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (created_at - oracle_timestamp)))::numeric, 1) AS p90,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (created_at - oracle_timestamp)))::numeric, 1) AS p95,
  ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (created_at - oracle_timestamp)))::numeric, 1) AS p99,
  ROUND(MAX(EXTRACT(EPOCH FROM (created_at - oracle_timestamp)))::numeric, 1) AS max_sec
FROM ora_enriched_transactions
WHERE created_at >= NOW() - INTERVAL '30 minutes';
```

### Monitoring resources during test

```powershell
# Run in a separate terminal while the test is active
.\scripts\monitor-resources-multi.ps1
```

Output goes to `reports/cdc-pipeline-resources-*.csv`.

---

## Running API Load Tests (k6)

### Local

```bash
k6 run --env-file=envs/dev.env scripts/api-load-test.js
```

### In-cluster (Kubernetes Job)

```bash
# Deploy the k6 job
kubectl apply -f k8s/k6-job.yaml

# Watch logs
kubectl logs -f job/k6-api-load-test
```

---

## Generating PDF Reports

All report generators output to `reports/cdc-pipeline/`.

```bash
# Final 100K performance report (latest optimized test)
npm run report:final

# 100K clean-slate report
npm run report:100k-clean

# 100K post-tuning report
npm run report:100k-tuned

# 100K defaults report
npm run report:100k-defaults

# 1M test report
npm run report:1m
```

Or run directly:

```bash
node scripts/generate-final-report.js
```

---

## Test Results Summary

| Test | Records | E2E Time | TPS | Data Loss |
|------|---------|----------|-----|-----------|
| 100K (final, tuned) | 100,000 | 462s | 216.4 | 0 |
| 100K (clean slate) | 100,000 | 551s | 181.4 | 0 |
| 100K (defaults) | 100,000 | 615s | 179.6 | 0 |
| 100K (post-tuning) | 100,000 | 597s | 188.7 | 0 |
| 1M | 1,000,000 | 5,763s | 173.5 | 0 |

### Metrics produced

| Metric | Description |
|--------|-------------|
| Oracle INSERT time | Time to insert batch into Oracle |
| Pipeline delivery time | Time for all records to appear in Postgres (after Oracle INSERT completes) |
| Total end-to-end time | INSERT start → last record in Postgres |
| Overall TPS | Transactions per second (end-to-end) |
| Pipeline TPS | Transactions per second (pipeline only) |

---

## Test Scenario 2: API Load Test

**What it tests:** `GET /fineract-provider/api/v1/cdc/savingsaccounts/{account}/transactions` under concurrent load.

### Run from local (via ingress)

```bash
# Default settings (dev environment)
k6 run load-tests/scripts/api-load-test.js

# With explicit environment file
k6 run --env-file=load-tests/envs/dev.env load-tests/scripts/api-load-test.js

# Override specific settings
k6 run \
  --env BASE_URL=https://access.dev.fiter.io \
  --env VUS_STAGE_4=500 \
  load-tests/scripts/api-load-test.js

# Export CSV alongside HTML report
k6 run --out csv=load-tests/reports/results.csv load-tests/scripts/api-load-test.js
```

### Run in-cluster (Kubernetes Job — recommended for accurate results)

```bash
# Step 1: Upload the k6 script as a ConfigMap
AWS_PROFILE=fiter kubectl create configmap k6-load-test-scripts \
  --from-file=api-load-test.js=load-tests/scripts/api-load-test.js \
  -n access --dry-run=client -o yaml | kubectl apply -f -

# Step 2: Run the Job
AWS_PROFILE=fiter kubectl apply -f load-tests/k8s/k6-job.yaml

# Step 3: Watch logs (live results)
AWS_PROFILE=fiter kubectl -n access logs -f job/k6-api-load-test

# Step 4: Clean up
AWS_PROFILE=fiter kubectl -n access delete job k6-api-load-test
```

### Run with different environment

```bash
# Staging
k6 run --env-file=load-tests/envs/staging.env load-tests/scripts/api-load-test.js

# Custom URL
k6 run --env BASE_URL=https://access.staging.fiter.io load-tests/scripts/api-load-test.js
```

### Load Profile

| Stage | Duration | Virtual Users | Purpose |
|-------|----------|---------------|---------|
| 1     | 1 min    | 100           | Warm-up / baseline |
| 2     | 2 min    | 250           | Moderate load |
| 3     | 3 min    | 500           | Heavy load |
| 4     | 3 min    | 1,000         | Peak simulation |
| 5     | 2 min    | 100           | Cool-down |

Customize via environment variables: `VUS_STAGE_1` through `VUS_STAGE_5`.

### Metrics produced

| Metric | Description |
|--------|-------------|
| `http_req_duration` | Request latency (p50, p95, p99, max) |
| `txn_endpoint_latency` | Custom latency tracking |
| `txn_error_rate` | Percentage of failed requests |
| `txn_successful_requests` | Total successful calls |
| `http_reqs` | Total request count and RPS |

### Thresholds (pass/fail)

| Metric | Threshold |
|--------|-----------|
| p95 response time | < 2,000ms |
| Error rate | < 5% |

### Reports

Reports are auto-generated in `load-tests/reports/`:

- **HTML** — visual charts, shareable with stakeholders
- **JSON** — raw data for custom analysis
- **Console** — printed to terminal during the run

---

## Interpreting Results

### CDC Pipeline (Scenario 1)

| Rating | End-to-End TPS | p95 Latency |
|--------|---------------|-------------|
| Excellent | > 500 txn/s | < 2s |
| Good | 200-500 txn/s | 2-5s |
| Acceptable | 50-200 txn/s | 5-15s |
| Needs tuning | < 50 txn/s | > 15s |

### API Endpoint (Scenario 2)

| Rating | p95 Response Time | Error Rate |
|--------|-------------------|------------|
| Excellent | < 200ms | 0% |
| Good | 200-500ms | < 1% |
| Acceptable | 500ms-1s | < 3% |
| Needs tuning | > 1s | > 5% |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| k6 `ECONNREFUSED` | Ensure port-forward is running or use in-cluster config |
| `401 Unauthorized` | Check `AUTH_TOKEN` is valid Base64 of `username:password` |
| CDC pipeline timeout | Check Debezium connector status: `curl localhost:8083/connectors/access-core-banking/status` |
| Low TPS in pipeline | Check Kafka consumer lag in Kafka UI, Debezium logs for LogMiner delays |
| High API latency | Check Synapse pod resources, PostgreSQL query performance |
