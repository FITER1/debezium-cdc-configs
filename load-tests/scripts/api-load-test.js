// =============================================================================
// Access Bank — API Load Test (k6)
// =============================================================================
// Tests: GET /fineract-provider/api/v1/cdc/savingsaccounts/{account}/transactions
//
// Usage:
//   k6 run load-tests/scripts/api-load-test.js
//   k6 run --env BASE_URL=https://access.dev.fiter.io load-tests/scripts/api-load-test.js
//   k6 run --env-file=load-tests/envs/dev.env load-tests/scripts/api-load-test.js
//
// Reports:
//   k6 run --out csv=load-tests/reports/api-results.csv load-tests/scripts/api-load-test.js
//   k6 run --out json=load-tests/reports/api-results.json load-tests/scripts/api-load-test.js
// =============================================================================

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.1.0/index.js";
import encoding from "k6/encoding";

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const txnLatency = new Trend("txn_endpoint_latency", true);
const txnErrors = new Rate("txn_error_rate");
const txnSuccess = new Counter("txn_successful_requests");
const txnFailed = new Counter("txn_failed_requests");

// ---------------------------------------------------------------------------
// Configuration from environment variables
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || "https://access.dev.fiter.io";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "bWlmb3M6cGFzc3dvcmQ=";
const TENANT_ID = __ENV.TENANT_ID || "default";
const ACCOUNTS = (__ENV.ACCOUNTS || "0011234501,0021234502,0031234503,0011234504,0021234505,0031234506,0011234507,0021234508,0031234509,0011234510").split(",");

// Virtual user stages (configurable)
const VUS_1 = parseInt(__ENV.VUS_STAGE_1 || "100");
const VUS_2 = parseInt(__ENV.VUS_STAGE_2 || "250");
const VUS_3 = parseInt(__ENV.VUS_STAGE_3 || "500");
const VUS_4 = parseInt(__ENV.VUS_STAGE_4 || "1000");
const VUS_5 = parseInt(__ENV.VUS_STAGE_5 || "100");

// Stage durations (configurable)
const DUR_1 = __ENV.DUR_STAGE_1 || "1m";
const DUR_2 = __ENV.DUR_STAGE_2 || "2m";
const DUR_3 = __ENV.DUR_STAGE_3 || "3m";
const DUR_4 = __ENV.DUR_STAGE_4 || "3m";
const DUR_5 = __ENV.DUR_STAGE_5 || "2m";

// ---------------------------------------------------------------------------
// Load profile — ramp up, sustain, ramp down
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: DUR_1, target: VUS_1 },    // Stage 1: Ramp to baseline
    { duration: DUR_2, target: VUS_2 },    // Stage 2: Moderate load
    { duration: DUR_3, target: VUS_3 },    // Stage 3: Heavy load
    { duration: DUR_4, target: VUS_4 },    // Stage 4: Peak load
    { duration: DUR_5, target: VUS_5 },    // Stage 5: Cool-down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],        // 95% of requests under 2s
    txn_endpoint_latency: ["p(95)<2000"],     // Custom metric threshold
    txn_error_rate: ["rate<0.05"],            // Less than 5% errors
  },
  tags: {
    testName: "access-bank-cdc-api-load-test",
  },
};

// ---------------------------------------------------------------------------
// Common headers
// ---------------------------------------------------------------------------
const headers = {
  "Content-Type": "application/json",
  "fineract-platform-tenantid": TENANT_ID,
  authorization: `Basic ${AUTH_TOKEN}`,
};

// ---------------------------------------------------------------------------
// Main test function — each VU executes this in a loop
// ---------------------------------------------------------------------------
export default function () {
  // Pick a random account from the pool
  const account = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];

  group("GET transactions", function () {
    const url = `${BASE_URL}/fineract-provider/api/v1/cdc/savingsaccounts/${account}/transactions`;

    const res = http.get(url, { headers, tags: { endpoint: "get_transactions", account } });

    txnLatency.add(res.timings.duration);

    const success = check(res, {
      "status is 200": (r) => r.status === 200,
      "response has transactions": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.transactions !== undefined;
        } catch (e) {
          return false;
        }
      },
      "response time < 500ms": (r) => r.timings.duration < 500,
      "response time < 1000ms": (r) => r.timings.duration < 1000,
      "response time < 2000ms": (r) => r.timings.duration < 2000,
    });

    if (success) {
      txnSuccess.add(1);
      txnErrors.add(0);
    } else {
      txnFailed.add(1);
      txnErrors.add(1);
    }
  });

  // Simulate user think time (300ms - 1s between requests)
  sleep(Math.random() * 0.7 + 0.3);
}

// ---------------------------------------------------------------------------
// Summary — generate HTML report + console + JSON
// ---------------------------------------------------------------------------
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportDir = __ENV.REPORT_DIR || "load-tests/reports";
  const html = htmlReport(data);
  const json = JSON.stringify(data, null, 2);

  const summary = {};

  // Always write files when a report directory is available
  summary[`${reportDir}/api-load-test-${timestamp}.html`] = html;
  summary[`${reportDir}/api-load-test-${timestamp}.json`] = json;

  // Build stdout: text summary + optional embedded reports for in-cluster extraction
  let stdoutContent = textSummary(data, { indent: " ", enableColors: true });

  if (__ENV.EMBED_REPORTS === "true") {
    const b64Html = encoding.b64encode(html);
    const b64Json = encoding.b64encode(json);
    stdoutContent += "\n===BEGIN_REPORT_HTML===\n" + b64Html + "\n===END_REPORT_HTML===\n";
    stdoutContent += "===BEGIN_REPORT_JSON===\n" + b64Json + "\n===END_REPORT_JSON===\n";
  }

  summary.stdout = stdoutContent;
  return summary;
}
