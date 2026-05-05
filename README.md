# Debezium CDC — Access Bank Flexcube

CDC deployment for Oracle Flexcube Core Banking → Debezium → Kafka → Synapse consumer.

## Architecture

```
Oracle (Flexcube) → Debezium Connect (LogMiner) → Kafka → Synapse (Java consumer)
```

**Schemas captured**: `ABFCUBSLIVE`, `NIPSYSTEM`, `WEBSERVE`

---

## 1. Infrastructure

Start all dependencies:

```bash
docker compose up -d
```

| Service | Port | Purpose |
|---------|------|---------|
| Oracle DB | 1521 | Flexcube database (PDB: `ACCESSBANK`) |
| Kafka | 9092 | Event broker (KRaft, no Zookeeper) |
| Debezium Connect | 8083 | CDC runtime |
| Kafka UI | 9099 | Topic monitoring |
| Redis | 6379 | Caching |

See [`docker-compose.yml`](docker-compose.yml) for full configuration.

---

## 2. Oracle Preparation

Run as SYSDBA on the Flexcube database. Full script: [`scripts/oracle/oracle-preparation-sql-scripts.sql`](scripts/oracle/oracle-preparation-sql-scripts.sql)

1. **Enable ARCHIVELOG** — `ALTER DATABASE ARCHIVELOG; ALTER DATABASE FORCE LOGGING;`
2. **Supplemental logging** — `ALTER DATABASE ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;`
3. **Table-level logging** — For each captured table
4. **Create user** — `CREATE USER C##DEBEZIUM IDENTIFIED BY <password> CONTAINER=ALL;`
5. **Grant privileges** — LogMiner, SELECT, FLASHBACK, CREATE TABLE (both CDB and PDB)

---

## 3. Debezium Connect

Custom image adds Groovy JARs for POV account filtering (~1000 accounts scoped from millions):

```dockerfile
FROM quay.io/debezium/connect:2.7
RUN cd /kafka/connect/debezium-connector-oracle && \
    curl -sO https://repo1.maven.org/maven2/io/debezium/debezium-scripting/2.7.0.Final/debezium-scripting-2.7.0.Final.jar && \
    curl -sO https://repo1.maven.org/maven2/org/codehaus/groovy/groovy/3.0.21/groovy-3.0.21.jar && \
    curl -sO https://repo1.maven.org/maven2/org/codehaus/groovy/groovy-jsr223/3.0.21/groovy-jsr223-3.0.21.jar
```

The Groovy filter ensures only CDC events for the POV account set are published to Kafka.

---

## 4. Deploy Connectors

```bash
bash scripts/connectors/create-accessbank-core-banking-connector.sh   # ABFCUBSLIVE tables
bash scripts/connectors/create-accessbank-nip-system-connector.sh     # NIPSYSTEM tables
bash scripts/connectors/create-accessbank-webserve-connector.sh       # WEBSERVE tables
```

### Captured Tables

| Connector | Tables |
|-----------|--------|
| Core Banking | `ACZB_HISTORY`, `ACZB_DAILY_LOG`, `STZM_CUST_ACCOUNT`, `STZM_CUSTOMER`, `STZM_TRN_CODE` |
| NIP System | `NIPX_DIRECT_CREDITS`, `NIPX_BANKS`, `NIPX_INBOUND_CREDITS` |
| Webserve | `PAYMENT_ROUTER_TXN_LOG`, `CSTM_PRODUCT_INTERFACE_MAPPING` |

---

## 5. Synapse Consumer

Java application consuming CDC events from Kafka using the inbox pattern:

- **Kafka Client**: `org.apache.kafka:kafka-clients:3.9.0`
- **Pattern**: Batch poll → persist to PostgreSQL inbox → process asynchronously
- **Config**: Set `KAFKA_BOOTSTRAP_SERVERS`, `KAFKA_TOPIC`, `KAFKA_GROUP_ID`, `KAFKA_CONSUMER_ENABLED=true`

---

## 6. Kafka Connect REST API

Base: `http://localhost:8083`

| Action | Method | Endpoint |
|--------|--------|----------|
| List connectors | GET | `/connectors` |
| Create connector | POST | `/connectors` |
| Get config | GET | `/connectors/{name}/config` |
| Update config | PUT | `/connectors/{name}/config` |
| Delete | DELETE | `/connectors/{name}` |
| Status | GET | `/connectors/{name}/status` |
| Pause | PUT | `/connectors/{name}/pause` |
| Resume | PUT | `/connectors/{name}/resume` |
| Restart | POST | `/connectors/{name}/restart?includeTasks=true&onlyFailed=true` |
| Task status | GET | `/connectors/{name}/tasks/{id}/status` |
| Restart task | POST | `/connectors/{name}/tasks/{id}/restart` |
| List plugins | GET | `/connector-plugins` |

---

## 7. Kafka Topics

Pattern: `{prefix}.{schema}.{table}`

- `accessbank-core.ABFCUBSLIVE.*` — Core banking CDC events
- `accessbank-nip.NIPSYSTEM.*` — NIP payment CDC events
- `accessbank-webserve.WEBSERVE.*` — Webserve CDC events

Monitor at: http://localhost:9099

---

## 8. Testing (Dev/UAT)

```bash
# Create simulation tables and seed data
sqlplus C##DEBEZIUM/oracle@//localhost:1521/ACCESSBANK @scripts/simulation/cdc-table-simulation.sql
sqlplus C##DEBEZIUM/oracle@//localhost:1521/ACCESSBANK @scripts/simulation/cdc-seed-data-simulation.sql
```

---

## 9. Troubleshooting

| Error | Fix |
|-------|-----|
| `ORA-00942` on `V$DATABASE` | `GRANT SELECT ON V_$DATABASE TO C##DEBEZIUM;` |
| `ORA-01031` on `CREATE TABLE LOG_MINING_FLUSH` | Grant `CREATE TABLE` + `UNLIMITED TABLESPACE` in PDB |
| `ORA-01031` on `AS OF SCN` | Grant `FLASHBACK ANY TABLE` in PDB |
| Connector running, no events | Check `database.dbname` matches CDB name |

```bash
# Check logs
docker logs debezium-connect --tail 100 -f | grep -i "ERROR\|Exception"

# Check all connector statuses
curl -s http://localhost:8083/connectors/accessbank-core-banking-connector/status | jq .
```

---

## Repo Structure

```
├── README.md
├── docker-compose.yml          # Infrastructure dependencies
└── scripts/
    ├── connectors/             # Connector creation scripts
    ├── oracle/                 # DBA preparation SQL
    └── simulation/             # Dev/test table & seed data
```
