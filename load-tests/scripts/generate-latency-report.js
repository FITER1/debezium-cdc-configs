/**
 * CDC Pipeline Latency Report Generator
 * ======================================
 * Reads per-row latency CSV (from cdc-latency-analysis.sh) and generates
 * a management-ready PDF with:
 *   - Executive summary with SLA pass/fail
 *   - Latency percentile table by stage
 *   - Throughput summary
 *
 * Usage:
 *   node scripts/generate-latency-report.js [csv_file]
 *   node scripts/generate-latency-report.js reports/latency-per-row-20260520-143000.csv
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const CSV_FILE = process.argv[2]
  ? path.resolve(process.argv[2])
  : findLatestCsv();
const OUTPUT_FILE = path.join(REPORTS_DIR, `cdc-latency-report-${timestamp()}.pdf`);

// SLA thresholds (seconds)
const SLA = { e2e_p95: 10, e2e_p99: 30, capture_p95: 8, consumer_p95: 5 };

// --- Helpers ---
function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function findLatestCsv() {
  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.startsWith('latency-per-row-') && f.endsWith('.csv'))
    .sort()
    .reverse();
  if (!files.length) { console.error('No latency CSV found in reports/'); process.exit(1); }
  return path.join(REPORTS_DIR, files[0]);
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil(p / 100 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function fmt(val) { return val.toFixed(3); }

const COLORS = {
  primary: '#1a365d',
  accent: '#38a169',
  danger: '#e53e3e',
  warning: '#d69e2e',
  text: '#2d3748',
  muted: '#718096',
  white: '#ffffff',
};

// --- Parse CSV ---
console.log(`Reading: ${CSV_FILE}`);
const lines = fs.readFileSync(CSV_FILE, 'utf8').trim().split('\n');
const header = lines[0].split(',');
const rows = lines.slice(1).map(line => {
  const cols = line.split(',');
  return {
    ac_entry_sr_no: cols[0],
    ac_no: cols[1],
    trn_ref_no: cols[2],
    ora_created_at: cols[3],
    kafka_published_at: cols[4],
    created_at: cols[5],  // may be 'created_at_utc' header
    capture_lag_sec: parseFloat(cols[6]) || 0,
    consumer_lag_sec: parseFloat(cols[7]) || 0,
    total_e2e_sec: parseFloat(cols[8]) || 0,
  };
});

if (!rows.length) { console.error('No data rows in CSV'); process.exit(1); }

// --- Compute stats ---
const captureLags = rows.map(r => r.capture_lag_sec).sort((a, b) => a - b);
const consumerLags = rows.map(r => r.consumer_lag_sec).sort((a, b) => a - b);
const e2eLags = rows.map(r => r.total_e2e_sec).sort((a, b) => a - b);

function stats(sorted) {
  return {
    min: sorted[0],
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1],
    avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
  };
}

const captureStats = stats(captureLags);
const consumerStats = stats(consumerLags);
const e2eStats = stats(e2eLags);

// Time window
const firstTs = new Date(rows[0].ora_created_at);
const lastTs = new Date(rows[rows.length - 1].created_at);
const durationSec = (lastTs - firstTs) / 1000;
const tps = rows.length / durationSec;

// SLA check
const slaResults = [
  { metric: 'E2E p95', value: e2eStats.p95, threshold: SLA.e2e_p95, pass: e2eStats.p95 <= SLA.e2e_p95 },
  { metric: 'E2E p99', value: e2eStats.p99, threshold: SLA.e2e_p99, pass: e2eStats.p99 <= SLA.e2e_p99 },
  { metric: 'Capture p95', value: captureStats.p95, threshold: SLA.capture_p95, pass: captureStats.p95 <= SLA.capture_p95 },
  { metric: 'Consumer p95', value: consumerStats.p95, threshold: SLA.consumer_p95, pass: consumerStats.p95 <= SLA.consumer_p95 },
];
const allPass = slaResults.every(r => r.pass);

// --- Generate PDF ---
const doc = new PDFDocument({ size: 'A4', margin: 50 });
doc.pipe(fs.createWriteStream(OUTPUT_FILE));

// Title
doc.fontSize(22).fillColor(COLORS.primary).font('Helvetica-Bold')
  .text('CDC Pipeline Latency Report', { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(11).fillColor(COLORS.muted).font('Helvetica')
  .text(`Access Bank — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, { align: 'center' });
doc.moveDown(1.5);

// Executive Summary
doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold').text('Executive Summary');
doc.moveDown(0.5);
doc.fontSize(11).fillColor(COLORS.text).font('Helvetica');
doc.text(`Records analyzed: ${rows.length.toLocaleString()}`);
doc.text(`Time window: ${durationSec.toFixed(0)}s (${(durationSec / 60).toFixed(1)} min)`);
doc.text(`Effective throughput: ${tps.toFixed(1)} transactions/sec`);
doc.moveDown(0.5);

const statusColor = allPass ? COLORS.accent : COLORS.danger;
const statusText = allPass ? '✓ ALL SLAs MET' : '✗ SLA BREACH DETECTED';
doc.fontSize(13).fillColor(statusColor).font('Helvetica-Bold').text(statusText);
doc.moveDown(1);

// SLA Table
doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold').text('SLA Compliance');
doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text);
doc.text('Metric              Measured    Threshold   Status', { continued: false });
doc.font('Helvetica');
for (const r of slaResults) {
  const status = r.pass ? 'PASS' : 'FAIL';
  const color = r.pass ? COLORS.accent : COLORS.danger;
  doc.fillColor(COLORS.text).text(
    `${r.metric.padEnd(20)}${fmt(r.value).padEnd(12)}≤ ${fmt(r.threshold).padEnd(10)}`,
    { continued: true }
  );
  doc.fillColor(color).text(status);
}
doc.moveDown(1.5);

// Latency Breakdown Table
doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold').text('Latency Breakdown (seconds)');
doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text);
doc.text('Stage                  p50      p90      p95      p99      max      avg');
doc.font('Helvetica');

function row(label, s) {
  doc.text(
    `${label.padEnd(23)}${fmt(s.p50).padEnd(9)}${fmt(s.p90).padEnd(9)}${fmt(s.p95).padEnd(9)}${fmt(s.p99).padEnd(9)}${fmt(s.max).padEnd(9)}${fmt(s.avg)}`
  );
}
row('Capture (Oracle→Kafka)', captureStats);
row('Consumer (Kafka→PG)', consumerStats);
row('Total E2E (Oracle→PG)', e2eStats);
doc.moveDown(1.5);

// Pipeline Architecture
doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold').text('Pipeline Architecture');
doc.moveDown(0.5);
doc.fontSize(10).fillColor(COLORS.text).font('Helvetica');
doc.text('Oracle (Flexcube) → Debezium LogMiner → Kafka (4 partitions) → Synapse CDC Consumer (3 replicas) → PostgreSQL');
doc.moveDown(0.3);
doc.text(`Capture lag = time from Oracle COMMIT to Kafka broker receipt (includes LogMiner polling + Debezium serialization)`);
doc.text(`Consumer lag = time from Kafka receipt to PostgreSQL INSERT (includes enrichment + batch upsert)`);
doc.moveDown(1.5);

// Footer
doc.fontSize(9).fillColor(COLORS.muted)
  .text(`Source: ${path.basename(CSV_FILE)}`, 50, doc.page.height - 50);

doc.end();
console.log(`PDF generated: ${OUTPUT_FILE}`);
