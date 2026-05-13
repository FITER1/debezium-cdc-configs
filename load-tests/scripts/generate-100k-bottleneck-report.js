const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const REPORTS_DIR = path.join(__dirname, "..", "reports", "cdc-pipeline");
fs.mkdirSync(REPORTS_DIR, { recursive: true });
const OUTPUT = path.join(REPORTS_DIR, "CDC_Pipeline_100K_Bottleneck_Analysis.pdf");

const doc = new PDFDocument({ size: "A4", margin: 40 });
const out = fs.createWriteStream(OUTPUT);
doc.pipe(out);

const NAVY="#1a365d",BLUE="#2b6cb0",GREEN="#276749",RED="#c53030",
  ORANGE="#dd6b20",TEAL="#2c7a7b",YELLOW="#d69e2e",GRAY="#718096",
  LGRAY="#e2e8f0",LBGRAY="#f7fafc",WHITE="#fff",DARK="#2d3748",
  PURPLE="#6b46c1";
const L=40, R=555, PW=R-L;

const D = {
  records: 100000,
  oracleInsert: 58.14,
  deliveryTime: 415.58,
  totalE2E: 424.40,
  tps: 240.6,
  peakTPS: 365,
  slowTPS: 137,
  date: "May 13, 2026",
  insertStart: "09:13:10.954 UTC",
  insertEnd: "09:14:09.095 UTC",
  firstArrival: "09:13:19.776 UTC",
  lastArrival: "09:20:15.357 UTC",
  debit: 62639, credit: 37361,
  modRT: 80085, modAC: 14944, modIC: 4971,
  // Delivery phases
  phase1: { start:"09:13:24", end:"09:16:22", records:51451, durationS:178, tps:289 },
  phase2: { start:"09:16:22", end:"09:17:54", records:12426, durationS:92, tps:135 },
  phase3: { start:"09:17:54", end:"09:20:17", records:36123, durationS:143, tps:253 },
};

// 5-second polling data (records per 5s interval)
const arrivalRate = [
  {t:"13:24",n:764},{t:"13:29",n:1245},{t:"13:34",n:1368},{t:"13:39",n:1140},{t:"13:44",n:1140},
  {t:"13:49",n:1140},{t:"13:54",n:1296},{t:"13:59",n:1254},{t:"14:05",n:1254},{t:"14:10",n:1254},
  {t:"14:15",n:1140},{t:"14:20",n:1368},{t:"14:25",n:1368},{t:"14:30",n:1368},{t:"14:35",n:1482},
  {t:"14:40",n:1482},{t:"14:46",n:1140},{t:"14:51",n:1596},{t:"14:56",n:1368},{t:"15:01",n:1482},
  {t:"15:06",n:1368},{t:"15:11",n:1254},{t:"15:16",n:1482},{t:"15:21",n:1596},{t:"15:26",n:1596},
  {t:"15:31",n:1824},{t:"15:37",n:1596},{t:"15:42",n:1824},{t:"15:47",n:1596},{t:"15:52",n:1824},
  {t:"15:57",n:1596},{t:"16:02",n:1710},{t:"16:07",n:1596},{t:"16:12",n:1824},{t:"16:17",n:1596},
  {t:"16:22",n:1520},
  // Phase 2 - single consumer (drop)
  {t:"16:27",n:684},{t:"16:33",n:684},{t:"16:38",n:684},{t:"16:43",n:684},{t:"16:48",n:684},
  {t:"16:53",n:684},{t:"16:58",n:684},{t:"17:03",n:684},{t:"17:08",n:684},{t:"17:13",n:684},
  {t:"17:18",n:684},{t:"17:23",n:684},{t:"17:29",n:684},{t:"17:34",n:684},{t:"17:39",n:684},
  {t:"17:44",n:684},{t:"17:49",n:684},
  // Phase 3 - recovery
  {t:"17:54",n:798},{t:"17:59",n:1254},{t:"18:04",n:1140},{t:"18:09",n:1368},{t:"18:14",n:1368},
  {t:"18:20",n:1368},{t:"18:25",n:1140},{t:"18:30",n:1368},{t:"18:35",n:1368},{t:"18:40",n:1368},
  {t:"18:45",n:1140},{t:"18:50",n:1368},{t:"18:55",n:1140},{t:"19:00",n:1368},{t:"19:05",n:1368},
  {t:"19:10",n:1368},{t:"19:16",n:1140},{t:"19:21",n:1368},{t:"19:26",n:1368},{t:"19:31",n:1368},
  {t:"19:36",n:1140},{t:"19:41",n:1368},{t:"19:46",n:1368},{t:"19:51",n:1368},{t:"19:56",n:1368},
  {t:"20:01",n:1140},{t:"20:07",n:1439},{t:"20:12",n:1254},{t:"20:17",n:940},
];

// Resource snapshots
const resources = [
  {phase:"Baseline (idle)", oracle:"86m/2556Mi", debezium:"39m/1830Mi", kafka:"50-90m", consumer1:"7m/199Mi", consumer2:"7m/199Mi", redis:"3m/22Mi"},
  {phase:"INSERT start", oracle:"469m/2622Mi", debezium:"723m/1831Mi", kafka:"122-198m", consumer1:"126m", consumer2:"190m", redis:"44m/24Mi"},
  {phase:"INSERT mid", oracle:"542m/2666Mi", debezium:"723m/1831Mi", kafka:"1268-1433m", consumer1:"288m", consumer2:"276m", redis:"132m/39Mi"},
  {phase:"Post-INSERT", oracle:"183m/2696Mi", debezium:"946m/1830Mi", kafka:"1110-1310m", consumer1:"287m", consumer2:"276m", redis:"164m/53Mi"},
  {phase:"Peak delivery", oracle:"69m/2683Mi", debezium:"351m/1831Mi", kafka:"688-1286m", consumer1:"279m", consumer2:"267m", redis:"131m/70Mi"},
  {phase:"Consumer-2 done", oracle:"71m/2626Mi", debezium:"41m/1831Mi", kafka:"53-67m", consumer1:"187m", consumer2:"276m", redis:"182m/82Mi"},
  {phase:"Single consumer", oracle:"71m/2626Mi", debezium:"41m/1831Mi", kafka:"idle", consumer1:"7m", consumer2:"223m", redis:"79m/85Mi"},
  {phase:"Tail recovery", oracle:"74m/2627Mi", debezium:"39m/1830Mi", kafka:"idle", consumer1:"7m", consumer2:"239m", redis:"83m/90Mi"},
  {phase:"Final (idle)", oracle:"71m/2585Mi", debezium:"38m/1830Mi", kafka:"idle", consumer1:"7m/199Mi", consumer2:"159m/267Mi", redis:"47m/92Mi"},
];

/* ── helpers ── */
function sec(t,y){
  doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text(t,L,y);
  doc.moveTo(L,y+14).lineTo(R,y+14).strokeColor(LGRAY).lineWidth(0.6).stroke();
  return y+19;
}

function kpi(x,y,w,h,label,val,sub,bg,valSize){
  doc.roundedRect(x,y,w,h,5).fill(bg);
  doc.font("Helvetica").fontSize(7).fillColor("rgba(255,255,255,0.85)").text(label,x+8,y+6,{width:w-16});
  doc.font("Helvetica-Bold").fontSize(valSize||20).fillColor(WHITE).text(val,x+8,y+18,{width:w-16});
  if(sub)doc.font("Helvetica").fontSize(6.5).fillColor("rgba(255,255,255,0.6)").text(sub,x+8,y+h-13,{width:w-16});
}

function tbl(hdr,rows,y,cw,al){
  const rh=16,tw=cw.reduce((a,b)=>a+b,0);
  doc.roundedRect(L,y,tw,rh,2).fill(NAVY);
  let x=L;hdr.forEach((h,i)=>{doc.font("Helvetica-Bold").fontSize(6).fillColor(WHITE).text(h,x+4,y+4,{width:cw[i]-8,align:(al&&al[i])||"left"});x+=cw[i];});
  y+=rh;
  rows.forEach((row,ri)=>{doc.rect(L,y,tw,rh).fill(ri%2===0?LBGRAY:WHITE);x=L;row.forEach((c,ci)=>{doc.font("Helvetica").fontSize(6).fillColor(DARK).text(String(c),x+4,y+4,{width:cw[ci]-8,align:(al&&al[ci])||"left"});x+=cw[ci];});y+=rh;});
  return y;
}

function bullet(text, y, color) {
  doc.font("Helvetica").fontSize(7).fillColor(color||DARK).text("  \u2022 "+text,L,y,{width:PW,lineGap:1});
  return y + doc.heightOfString("  \u2022 "+text,{width:PW,lineGap:1}) + 2;
}

function footer(page,total){
  doc.moveTo(L,783).lineTo(R,783).strokeColor(LGRAY).lineWidth(0.4).stroke();
  doc.font("Helvetica").fontSize(6).fillColor(GRAY).text(`CDC Pipeline 100K Bottleneck Analysis | ${D.date} | Page ${page}/${total}`,L,787,{width:PW,align:"center"});
}

/* ====== PAGE 1 — Executive Summary ====== */
doc.rect(0,0,595,90).fill(NAVY);
doc.rect(0,0,595,3).fill(RED);
doc.font("Helvetica-Bold").fontSize(18).fillColor(WHITE).text("CDC Pipeline Bottleneck Analysis",L,16);
doc.font("Helvetica").fontSize(9).fillColor("#a0aec0").text("100,000 Transactions | Full Resource Monitoring | Bottleneck Identification",L,38);
doc.font("Helvetica").fontSize(7.5).fillColor("#a0aec0").text(`Date: ${D.date}  |  EKS: fiter-us-east-2-dev  |  Region: us-east-2  |  Clean Redo (purged before test)`,L,53);
doc.font("Helvetica-Bold").fontSize(8).fillColor(YELLOW).text("PRIMARY BOTTLENECK: Synapse Consumer Enrichment Service (TransactionEnrichmentService)",L,68);

// KPIs
const bw=102,bh=55;
kpi(L,      98,bw,bh,"Total Records","100K","enriched in PostgreSQL",GREEN,18);
kpi(L+bw+4, 98,bw,bh,"Delivery Time","415.6s","first >> last arrival",RED,18);
kpi(L+2*(bw+4),98,bw,bh,"Peak TPS","289","both consumers active",TEAL,18);
kpi(L+3*(bw+4),98,bw,bh,"Slow TPS","135","single consumer only",ORANGE,18);
kpi(L+4*(bw+4),98,bw,bh,"INSERT","58.1s","100K Oracle rows",BLUE,18);

let y = sec("Pipeline Timing Breakdown",162);
y=tbl(["Phase","Duration","Detail"],[
  ["Oracle INSERT (100K txns)","58.14s","100K ACZB_HISTORY rows via PL/SQL bulk insert (1,720 txn/s)"],
  ["CDC Detection Latency","~9s","First record appears in PG at 09:13:19 (INSERT started 09:13:10)"],
  ["Pipeline Delivery","415.58s","First PG arrival to last (100K enriched records)"],
  ["Total End-to-End","424.40s","INSERT start to last PG record (09:13:10 >> 09:20:15 UTC)"],
],y,[130,60,325],["left","center","left"]);

y=sec("Delivery Rate: Three Distinct Phases",y+8);
y=tbl(["Phase","Time Window","Duration","Records","TPS","Bottleneck"],[
  ["Phase 1: Both Consumers","09:13:24 - 09:16:22","178s","51,451","289","Consumers at CPU capacity"],
  ["Phase 2: Single Consumer","09:16:22 - 09:17:54","92s","12,426","135","Consumer-2 idle (partition done)"],
  ["Phase 3: Fast Partition","09:17:54 - 09:20:17","143s","36,123","253","Consumer-1 on less-enriched data"],
],y,[115,95,45,50,35,175],["left","left","center","center","center","left"]);

y=sec("Transaction Breakdown",y+8);
y=tbl(["Category","Count","Percentage"],[
  ["Debit (D)","62,639","62.6%"],
  ["Credit (C)","37,361","37.4%"],
  ["Module: RT (Payment Router)","80,085","80.1%"],
  ["Module: AC (Core Banking)","14,944","14.9%"],
  ["Module: IC (Inbound Credits)","4,971","5.0%"],
],y,[200,100,215],["left","center","center"]);

y = sec("Delivery Rate Chart (records per 5s interval)", y+8);
// Mini bar chart of arrival rate
const chartX=L+25, chartY=y+5, chartW=PW-30, chartH=80;
const maxRate = 1824;
doc.moveTo(chartX,chartY+chartH).lineTo(chartX+chartW,chartY+chartH).strokeColor(LGRAY).lineWidth(0.4).stroke();
doc.moveTo(chartX,chartY).lineTo(chartX,chartY+chartH).strokeColor(LGRAY).lineWidth(0.4).stroke();
// Y-axis labels
[0,500,1000,1500,2000].forEach(v=>{
  const yp=chartY+chartH-(v/maxRate)*chartH*0.95;
  doc.font("Helvetica").fontSize(4.5).fillColor(GRAY).text(String(v),L,yp-3,{width:22,align:"right"});
  if(v>0)doc.moveTo(chartX,yp).lineTo(chartX+chartW,yp).strokeColor("#edf2f7").lineWidth(0.2).stroke();
});
// Bars
const bw2=chartW/arrivalRate.length;
arrivalRate.forEach((d,i)=>{
  const bh2=(d.n/maxRate)*chartH*0.95;
  const bx=chartX+i*bw2;
  const by=chartY+chartH-bh2;
  let color = GREEN;
  if(i>=36 && i<53) color = RED; // Phase 2
  else if(i>=53) color = BLUE; // Phase 3
  doc.rect(bx,by,bw2-0.5,bh2).fill(color);
});
// Phase labels
doc.font("Helvetica-Bold").fontSize(5).fillColor(GREEN).text("Phase 1 (289 TPS)",chartX+5,chartY+chartH+3);
doc.font("Helvetica-Bold").fontSize(5).fillColor(RED).text("Phase 2 (135 TPS)",chartX+chartW*0.43,chartY+chartH+3);
doc.font("Helvetica-Bold").fontSize(5).fillColor(BLUE).text("Phase 3 (253 TPS)",chartX+chartW*0.7,chartY+chartH+3);
y=chartY+chartH+14;

footer(1,3);

/* ====== PAGE 2 — Resource Monitoring ====== */
doc.addPage();
doc.rect(0,0,595,3).fill(RED);

y=sec("Resource Monitoring: CPU & Memory (All Components)",14);
y=tbl(
  ["Phase","Oracle CPU/RAM","Debezium CPU/RAM","Kafka CPU (3 brokers)","Consumer-1","Consumer-2","Redis CPU/RAM"],
  resources.map(r=>[r.phase,r.oracle,r.debezium,r.kafka,r.consumer1,r.consumer2,r.redis]),
  y,[80,72,75,80,60,60,68],["left","left","left","left","left","left","left"]
);

y=sec("Resource Limits vs Peak Usage",y+10);
y=tbl(["Component","CPU Limit","CPU Peak","% of Limit","RAM Limit","RAM Peak","% of Limit","Bottleneck?"],[
  ["Oracle XE","No limit","542m","N/A","4Gi","2696Mi","66%","NO"],
  ["Debezium Connect","2000m","946m","47%","3Gi","1831Mi","60%","NO"],
  ["Kafka Brokers (each)","2000m","1433m","72%","4Gi","2172Mi","53%","NO"],
  ["Consumer-1","No limit (req 250m)","288m","115% of req","1Gi","267Mi","26%","YES - CPU"],
  ["Consumer-2","No limit (req 250m)","276m","110% of req","1Gi","199Mi","19%","YES - CPU"],
  ["Redis","No limit","182m","N/A","No limit","92Mi","N/A","NO"],
],y,[95,60,50,48,52,52,48,60],["left","center","center","center","center","center","center","center"]);

y=sec("Bottleneck Analysis: Consumer Enrichment Service",y+10);
doc.roundedRect(L,y,PW,60,4).fill("#fff5f5").stroke(RED);
doc.font("Helvetica-Bold").fontSize(8).fillColor(RED).text("PRIMARY BOTTLENECK IDENTIFIED",L+10,y+6);
doc.font("Helvetica").fontSize(7).fillColor(DARK);
const bottleneckText = [
  "The Synapse Consumer (TransactionEnrichmentService) performs per-record enrichment that is CPU-bound:",
  "  1. Redis lookup: Re-enriching PARTIAL transaction by external_ref (per record)",
  "  2. PostgreSQL query: SELECT ac_no FROM ora_aczb_daily_log WHERE trn_ref_no = $1 AND ac_no <> $2 LIMIT 1",
  "  3. Buffer + write enriched record to ora_enriched_transactions (batched)",
];
bottleneckText.forEach((t,i)=>{
  doc.text(t,L+10,y+18+i*10,{width:PW-20});
});
y+=70;

y=sec("Secondary Issue: Kafka Partition Imbalance",y+5);
doc.roundedRect(L,y,PW,50,4).fill("#fffaf0").stroke(ORANGE);
doc.font("Helvetica-Bold").fontSize(8).fillColor(ORANGE).text("PARTITION ASSIGNMENT IMBALANCE",L+10,y+6);
doc.font("Helvetica").fontSize(7).fillColor(DARK);
doc.text("Consumer Group: synapse-cdc-consumer (2 members, 3 partitions)",L+10,y+18,{width:PW-20});
doc.text("  Consumer-1 (172.16.18.226): Partitions 0 + 1 (heavy ACZB_HISTORY data) \u2192 processed 2/3 of all records",L+10,y+28,{width:PW-20});
doc.text("  Consumer-2 (172.16.18.230): Partition 2 only \u2192 finished at 09:16:22, sat IDLE for remaining 4 minutes",L+10,y+38,{width:PW-20});
y+=58;

y=sec("Component Timeline",y+5);
y=tbl(["Time (UTC)","Event","Component","Status"],[
  ["09:13:10","INSERT starts","Oracle XE","CPU spikes to 542m"],
  ["09:13:19","First PG record arrives","Consumer","9s after INSERT start"],
  ["09:14:09","INSERT completes (58s)","Oracle XE","CPU drops to 71m (idle)"],
  ["09:14:30","Debezium peaks at 946m","Debezium","Streaming all changes to Kafka"],
  ["09:15:19","Debezium finishes capture","Debezium","CPU drops to 41m (idle)"],
  ["09:15:31","Kafka brokers idle","Kafka","All messages produced, CPU drops"],
  ["09:16:22","Consumer-2 finishes","Consumer-2","Partition 2 fully consumed, IDLE"],
  ["09:16:22","TPS drops 289 \u2192 135","Consumer-1","Only 1 consumer processing"],
  ["09:17:54","Consumer-1 hits faster data","Consumer-1","TPS recovers to 253"],
  ["09:20:15","Last record delivered","Consumer-1","100K records complete"],
],y,[55,175,80,205],["left","left","left","left"]);

y=sec("Storage Impact",y+8);
y=tbl(["Component","Before Test","After Test","Change","Bottleneck?"],[
  ["Oracle Data (PDB)","16G","17G","+1G (WAL + data)","NO"],
  ["Oracle Archive Logs","0 (purged)","0 (no archiving)","None","NO"],
  ["Kafka PVCs (per broker)","7.2G","7.2G","Negligible","NO"],
  ["Redis Memory","22Mi","92Mi","+70Mi (enrichment cache)","NO"],
],y,[120,80,80,100,135],["left","center","center","center","center"]);

footer(2,3);

/* ====== PAGE 3 — Recommendations ====== */
doc.addPage();
doc.rect(0,0,595,3).fill(RED);

y=sec("Performance Summary: Pipeline Capacity Analysis",14);
y=tbl(["Metric","This Test (100K)","Previous 100K","1K Clean Redo","Notes"],[
  ["Records Delivered","100,000","99,993","2,000","Clean tables, identical pipeline"],
  ["Oracle INSERT","58.14s","55.59s","0.073s","Consistent Oracle perf (~1,720 txn/s)"],
  ["Delivery Time","415.58s","430.5s","8.85s","3.5% faster (clean tables help)"],
  ["End-to-End","424.40s","433.2s","8.92s","Includes INSERT time"],
  ["Effective TPS","240.6","232.3","226.0","Higher with 2-consumer parallelism"],
  ["Peak TPS","289","~230","~226","Phase 1: both consumers saturated"],
  ["Trough TPS","135","--","--","Phase 2: single consumer bottleneck"],
],y,[95,80,80,80,180],["left","center","center","center","left"]);

y=sec("Recommendations: Increasing Throughput",y+10);
doc.roundedRect(L,y,PW,16,2).fill(GREEN);
doc.font("Helvetica-Bold").fontSize(7).fillColor(WHITE).text("HIGH PRIORITY (Expected 2-3x throughput improvement)",L+8,y+4,{width:PW-16});
y+=20;
y=bullet("Increase consumer replicas from 2 to 3 (match partition count). Current imbalance leaves 1 consumer idle for 50% of delivery time.",y);
y=bullet("Increase consumer CPU request from 250m to 500m. Consumers are CPU-bound at 280m; more CPU = faster enrichment per record.",y);
y=bullet("Batch enrichment queries: Replace per-record SELECT with batch IN(...) query for trn_ref_no lookups. Reduces PG round-trips by 90%+.",y);
y+=5;
doc.roundedRect(L,y,PW,16,2).fill(ORANGE);
doc.font("Helvetica-Bold").fontSize(7).fillColor(WHITE).text("MEDIUM PRIORITY (Expected 20-40% improvement)",L+8,y+4,{width:PW-16});
y+=20;
y=bullet("Increase Kafka partitions from 3 to 6 per topic. Allows better parallelism with more consumers and avoids imbalanced assignment.",y);
y=bullet("Use Redis pipeline/MGET for batch enrichment lookups instead of per-record GET operations.",y);
y=bullet("Add composite index on ora_aczb_daily_log(trn_ref_no, ac_no) if not already present to speed up enrichment cross-reference query.",y);
y+=5;
doc.roundedRect(L,y,PW,16,2).fill(BLUE);
doc.font("Helvetica-Bold").fontSize(7).fillColor(WHITE).text("LOW PRIORITY (Operational improvements)",L+8,y+4,{width:PW-16});
y+=20;
y=bullet("Implement automated archived redo log cleanup (RMAN retention policy). Prevents LogMiner degradation in production.",y);
y=bullet("Set CPU limits on consumers (currently only request=250m, no limit). Prevents noisy-neighbor CPU starvation on shared nodes.",y);
y=bullet("Monitor Kafka consumer lag with alerting. Lag > 10K for > 60s should trigger scaling.",y);

y=sec("Bottleneck Hierarchy (Slowest to Fastest)",y+10);
y=tbl(["Rank","Component","Role","Peak CPU","Constraint","Impact"],[
  ["#1","Synapse Consumer","Enrichment","288m (CPU-bound)","Per-record Redis+PG query","LIMITS PIPELINE TO 240 TPS"],
  ["#2","Kafka Partition Balance","Distribution","N/A","2/3 data on 1 consumer","50% idle time for 1 consumer"],
  ["#3","Debezium LogMiner","CDC Capture","946m (47% limit)","Redo log scanning","NOT a bottleneck (finishes early)"],
  ["#4","Kafka Brokers","Message Bus","1433m (72% limit)","Network + disk I/O","NOT a bottleneck (handles load)"],
  ["#5","Oracle XE","Source DB","542m (no limit)","INSERT speed","NOT a bottleneck (1720 txn/s)"],
  ["#6","PostgreSQL RDS","Target DB","N/A (managed)","Write throughput","NOT a bottleneck (keeps up)"],
],y,[30,95,70,75,110,135],["center","left","left","left","left","left"]);

y=sec("Conclusion",y+10);
const conclusions = [
  `The CDC pipeline successfully delivered 100,000 enriched records end-to-end in 424.4 seconds (240.6 TPS average).`,
  `The PRIMARY bottleneck is the Synapse Consumer enrichment logic: per-record Redis lookup + PostgreSQL cross-reference query consumes all available CPU (280m/consumer).`,
  `The SECONDARY issue is Kafka partition imbalance: with 3 partitions and 2 consumers, one consumer gets 2 partitions and becomes the long pole, reducing effective TPS by 53% during the tail phase.`,
  `Oracle, Debezium, Kafka brokers, and PostgreSQL are NOT bottlenecks — all finished their work well before consumers completed processing.`,
  `With the recommended changes (3 consumers, higher CPU, batch queries), projected throughput: 500-700 TPS (2-3x current).`,
];
conclusions.forEach(c=>{y=bullet(c,y);});

footer(3,3);

doc.end();
out.on("finish",()=>console.log("PDF -> " + OUTPUT));
