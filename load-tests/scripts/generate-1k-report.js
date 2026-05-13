const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const REPORTS_DIR = path.join(__dirname, "..", "reports", "cdc-pipeline");
fs.mkdirSync(REPORTS_DIR, { recursive: true });
const OUTPUT = path.join(REPORTS_DIR, "CDC_Pipeline_1K_Performance_Report.pdf");

const doc = new PDFDocument({ size: "A4", margin: 40 });
const out = fs.createWriteStream(OUTPUT);
doc.pipe(out);

const NAVY="#1a365d",BLUE="#2b6cb0",GREEN="#276749",RED="#c53030",
  ORANGE="#dd6b20",TEAL="#2c7a7b",YELLOW="#d69e2e",GRAY="#718096",
  LGRAY="#e2e8f0",LBGRAY="#f7fafc",WHITE="#fff",DARK="#2d3748";
const L=40, R=555, PW=R-L;

const D = {
  records:2000, oracleRows:2000,
  oracleInsert:0.073, deliveryTime:8.85, totalE2E:8.92,
  cdcLatency:"<0.1", tps:226.0, peakArrival:516,
  startUTC:"08:57:16 UTC", endUTC:"08:57:23 UTC", date:"May 13, 2026",
  debit:1252, credit:748, modRT:1594, modAC:303, modIC:103,
  oraHistory:2000,
  firstArrival:"08:57:14.130", lastArrival:"08:57:22.980",
  arrival:[
    {t:"08:57:14",n:29},{t:"08:57:15",n:292},{t:"08:57:16",n:516},
    {t:"08:57:17",n:163},{t:"08:57:19",n:88},{t:"08:57:20",n:242},
    {t:"08:57:21",n:260},{t:"08:57:23",n:410},
  ],
  // Previous 1K test (dirty redo, 1364 archived logs / ~8GB)
  prevDirty:{records:1000,oracleInsert:0.114,deliveryTime:5.96,totalE2E:8.66,cdcLatency:2.70,tps:167.8},
  // 100K tuned comparison
  cmp100k:{records:99993,oracleInsert:55.59,deliveryTime:430.5,totalE2E:433.2,tps:232.3},
};

/* ── helpers ── */
function sec(t,y){
  doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text(t,L,y);
  doc.moveTo(L,y+14).lineTo(R,y+14).strokeColor(LGRAY).lineWidth(0.6).stroke();
  return y+19;
}

function kpi(x,y,w,h,label,val,sub,bg,valSize){
  doc.roundedRect(x,y,w,h,5).fill(bg);
  doc.font("Helvetica").fontSize(7).fillColor("rgba(255,255,255,0.85)").text(label,x+10,y+7,{width:w-20});
  doc.font("Helvetica-Bold").fontSize(valSize||22).fillColor(WHITE).text(val,x+10,y+19,{width:w-20});
  if(sub)doc.font("Helvetica").fontSize(6.5).fillColor("rgba(255,255,255,0.6)").text(sub,x+10,y+h-13,{width:w-20});
}

function tbl(hdr,rows,y,cw,al){
  const rh=19,tw=cw.reduce((a,b)=>a+b,0);
  doc.roundedRect(L,y,tw,rh,2).fill(NAVY);
  let x=L;hdr.forEach((h,i)=>{doc.font("Helvetica-Bold").fontSize(6.5).fillColor(WHITE).text(h,x+5,y+5,{width:cw[i]-10,align:(al&&al[i])||"left"});x+=cw[i];});
  y+=rh;
  rows.forEach((row,ri)=>{doc.rect(L,y,tw,rh).fill(ri%2===0?LBGRAY:WHITE);x=L;row.forEach((c,ci)=>{doc.font("Helvetica").fontSize(6.5).fillColor(DARK).text(String(c),x+5,y+5,{width:cw[ci]-10,align:(al&&al[ci])||"left"});x+=cw[ci];});y+=rh;});
  return y;
}

function bars(data,x0,y0,w,h,title,yLab,color,lk,vk){
  if(title)doc.font("Helvetica-Bold").fontSize(7.5).fillColor(DARK).text(title,x0,y0-11,{width:w,align:"center"});
  const cL=x0+32,cB=y0+h,cW=w-38,mx=Math.max(...data.map(d=>d[vk]))*1.15;
  const bW=Math.min(40,(cW/data.length)*0.55),gap=(cW-bW*data.length)/(data.length+1);
  doc.moveTo(cL,y0).lineTo(cL,cB).strokeColor(LGRAY).lineWidth(0.4).stroke();
  doc.moveTo(cL,cB).lineTo(cL+cW,cB).strokeColor(LGRAY).lineWidth(0.4).stroke();
  for(let i=0;i<=4;i++){
    const v=Math.round(mx*i/4),yp=cB-(h*i/4);
    doc.font("Helvetica").fontSize(5).fillColor(GRAY).text(String(v),x0,yp-3,{width:30,align:"right"});
    if(i>0)doc.moveTo(cL,yp).lineTo(cL+cW,yp).strokeColor("#edf2f7").lineWidth(0.25).stroke();
  }
  data.forEach((d,i)=>{
    const bx=cL+gap+i*(bW+gap),bh2=(d[vk]/mx)*h,by=cB-bh2;
    doc.roundedRect(bx,by,bW,bh2,2).fill(typeof color==="function"?color(i):color);
    doc.font("Helvetica-Bold").fontSize(5.5).fillColor(DARK).text(String(d[vk]),bx-5,by-8,{width:bW+10,align:"center"});
    doc.font("Helvetica").fontSize(5).fillColor(GRAY).text(d[lk],bx-5,cB+2,{width:bW+10,align:"center"});
  });
  return cB+13;
}

function footer(page,total){
  doc.moveTo(L,783).lineTo(R,783).strokeColor(LGRAY).lineWidth(0.4).stroke();
  doc.font("Helvetica").fontSize(6).fillColor(GRAY).text(`CDC Pipeline Performance Report | 1K Transactions | ${D.date} | Page ${page}/${total}`,L,787,{width:PW,align:"center"});
}

/* ====== PAGE 1 ====== */
doc.rect(0,0,595,85).fill(NAVY);
doc.rect(0,0,595,3).fill(GREEN);
doc.font("Helvetica-Bold").fontSize(20).fillColor(WHITE).text("CDC Pipeline Performance Report",L,18);
doc.font("Helvetica").fontSize(8.5).fillColor("#a0aec0").text("1,000 Transactions (Clean Redo) | Oracle XE >> Debezium >> Kafka >> Synapse Consumer >> PostgreSQL",L,43);
doc.font("Helvetica").fontSize(7.5).fillColor("#a0aec0").text(`Date: ${D.date}  |  Cluster: EKS fiter-us-east-2-dev  |  Region: us-east-2  |  Redo Log: Purged (831 archived logs / ~8GB removed)`,L,58);

const bw=123,bh=60;
kpi(L,93,bw,bh,"Pipeline TPS",String(D.tps),"records / sec",GREEN);
kpi(L+bw+5,93,bw,bh,"Delivery Time",D.deliveryTime+"s","2K records",RED);
kpi(L+2*(bw+5),93,bw,bh,"End-to-End",D.totalE2E+"s","insert >> last arrival",ORANGE);
kpi(L+3*(bw+5),93,bw,bh,"CDC Latency",D.cdcLatency+"s","near-instantaneous",TEAL,18);

let y=sec("Pipeline Timing",160);
y=tbl(["Phase","Duration","Detail"],[
  ["Oracle INSERT (source)",D.oracleInsert+"s","1,000 transactions >> 2,000 ACZB_HISTORY rows (clean tables, purged redo)"],
  ["CDC Capture Latency",D.cdcLatency+"s","Near-instantaneous with clean redo log (only 2 active log groups, 0 archived logs)"],
  ["CDC Pipeline Delivery",D.deliveryTime+"s","First arrival >> last record lands in PostgreSQL (consumer processing dominates)"],
  ["Total End-to-End",D.totalE2E+"s",`INSERT start >> last record in PostgreSQL (${D.startUTC} >> ${D.endUTC})`],
],y,[130,60,325],["left","center","left"]);

y=sec("Oracle Source Table Breakdown",y+5);
y=tbl(["Source Table","Schema","Oracle Rows","PG Enriched","Module"],[
  ["ACZB_HISTORY","ABFCUBSLIVE","2,000","2,000","RT=1594, AC=303, IC=103"],
  ["ACZB_DAILY_LOG","ABFCUBSLIVE","0","--","(empty after truncate)"],
  ["NIPX_*","NIPSYSTEM","0","--","(empty after truncate)"],
  ["PAYMENT_ROUTER_TXN_LOG","WEBSERVE","0","--","(empty after truncate)"],
  ["TOTAL","","2,000","2,000",""],
],y,[130,90,80,80,135],["left","left","center","center","left"]);

y=sec("Record Arrival Rate (per second)",y+5);
y=bars(D.arrival,L,y+10,PW,85,"","",i=>i===1?RED:GREEN,"t","n");

y=sec("Transaction Breakdown",y+2);
y=tbl(["Category","Count","Percentage"],[
  ["Debit (D)",D.debit.toLocaleString(),(D.debit/D.records*100).toFixed(1)+"%"],
  ["Credit (C)",D.credit.toLocaleString(),(D.credit/D.records*100).toFixed(1)+"%"],
  ["Module: RT (Payment Router)",D.modRT.toLocaleString(),(D.modRT/D.records*100).toFixed(1)+"%"],
  ["Module: AC (Core Banking)",D.modAC.toLocaleString(),(D.modAC/D.records*100).toFixed(1)+"%"],
  ["Module: IC (Inbound Credits)",D.modIC.toLocaleString(),(D.modIC/D.records*100).toFixed(1)+"%"],
],y,[200,100,215],["left","center","center"]);
footer(1,2);

/* ====== PAGE 2 — Architecture + Comparison + Summary ====== */
doc.addPage();
doc.rect(0,0,595,3).fill(GREEN);

y=sec("Pipeline Architecture",14);
doc.font("Helvetica").fontSize(7).fillColor(DARK).text("Oracle XE (3 schemas)  >>  Debezium LogMiner (3 connectors)  >>  Kafka (3-broker Strimzi, 3 partitions/topic)  >>  Synapse Consumer (x2)  >>  PostgreSQL (RDS)",L,y,{width:PW});y+=14;
y=tbl(["Component","Detail"],[
  ["Source Schemas","ABFCUBSLIVE (ACZB_HISTORY), NIPSYSTEM (NIPX_DIRECT_CREDITS, NIPX_INBOUND_CREDITS), WEBSERVE (PAYMENT_ROUTER_TXN_LOG)"],
  ["Debezium Connectors","access-core-banking, access-nip-system, access-webserve"],
  ["Kafka Cluster","3-broker Strimzi cluster (cdc-kafka-kafka-0/1/2), 10 topics x 3 partitions"],
  ["Consumer Config","2 replicas, group.id=synapse-cdc-consumer, max.poll.records=2000, fetch.min.bytes=64KB"],
  ["Target Database","PostgreSQL RDS (ora_enriched_transactions table)"],
  ["Container Platform","Amazon EKS (Kubernetes) across namespaces: access, access-cdc, kafka"],
],y,[120,395],["left","left"]);

y=sec("Scale Comparison: 1K (Clean) vs 1K (Dirty Redo) vs 100K",y+8);
y=tbl(["Metric","1K Clean Redo","1K Dirty Redo","100K Tuned","Notes"],[
  ["PG Records","2,000","1,000","99,993","Clean tables >> different enrichment count"],
  ["Oracle Insert",D.oracleInsert+"s",D.prevDirty.oracleInsert+"s",D.cmp100k.oracleInsert+"s","Clean redo: 36% faster INSERT"],
  ["CDC Latency",D.cdcLatency+"s",D.prevDirty.cdcLatency+"s","2.74s","Clean redo >> near-zero latency!"],
  ["Delivery Time",D.deliveryTime+"s",D.prevDirty.deliveryTime+"s",Math.round(D.cmp100k.deliveryTime)+"s","Consumer processing dominates"],
  ["End-to-End",D.totalE2E+"s",D.prevDirty.totalE2E+"s",Math.round(D.cmp100k.totalE2E)+"s",""],
  ["Pipeline TPS",D.tps+" TPS",D.prevDirty.tps+" TPS",D.cmp100k.tps+" TPS","35% higher with clean redo"],
],y,[95,80,80,80,180],["left","center","center","center","left"]);

y=sec("Key Finding: Redo Log Impact on CDC Latency",y+8);
const findings = [
  `CRITICAL: Purging 831 archived redo logs (~8GB) reduced CDC latency from ${D.prevDirty.cdcLatency}s to near-zero (${D.cdcLatency}s).`,
  `LogMiner scans ALL redo/archived logs to find changes. With 1,364 archived log catalog entries, LogMiner spent ~2.7s per mining cycle scanning stale logs before finding new changes.`,
  `After purge: only 2 active redo groups (10MB each), no archived logs on disk. LogMiner finds new changes immediately.`,
  `RECOMMENDATION: Implement automated archived log cleanup in production. Set DB_RECOVERY_FILE_DEST_SIZE and configure RMAN retention policies.`,
];
findings.forEach(b=>{
  doc.font("Helvetica").fontSize(7).fillColor(DARK).text("  - "+b,L,y,{width:PW,lineGap:1});
  y+=doc.heightOfString("  - "+b,{width:PW,lineGap:1})+3;
});

y=sec("Observations",y+5);
const observations = [
  `Pipeline delivered 2,000 enriched records (from 1,000 Oracle transactions) in ${D.totalE2E}s end-to-end at ${D.tps} TPS.`,
  `With clean redo logs, CDC capture latency dropped to near-zero (${D.cdcLatency}s). Debezium detected commits almost instantly.`,
  `Oracle INSERT completed in ${D.oracleInsert}s (36% faster than dirty-redo test: ${D.prevDirty.oracleInsert}s). Clean redo reduces Oracle write overhead.`,
  `Delivery time increased from ${D.prevDirty.deliveryTime}s to ${D.deliveryTime}s due to 2x more PG records (2,000 vs 1,000). Per-record delivery is actually faster.`,
  `Peak arrival rate: ${D.peakArrival} records/sec at 08:57:16. Two-wave delivery pattern: first wave (29-1000), brief pause, second wave (1088-2000).`,
  `Transaction mix: ${(D.debit/D.records*100).toFixed(1)}% Debit, ${(D.credit/D.records*100).toFixed(1)}% Credit. Module split: RT ${(D.modRT/D.records*100).toFixed(1)}%, AC ${(D.modAC/D.records*100).toFixed(1)}%, IC ${(D.modIC/D.records*100).toFixed(1)}%.`,
  `Tables truncated + redo purged before test. Clean baseline eliminates noise from stale data in LogMiner scans.`,
];
observations.forEach(b=>{
  doc.font("Helvetica").fontSize(7).fillColor(DARK).text("  - "+b,L,y,{width:PW,lineGap:1});
  y+=doc.heightOfString("  - "+b,{width:PW,lineGap:1})+3;
});

footer(2,2);

doc.end();
out.on("finish",()=>console.log("PDF -> " + OUTPUT));
