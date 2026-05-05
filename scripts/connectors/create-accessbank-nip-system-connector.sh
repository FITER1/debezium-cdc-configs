#!/bin/bash

curl -X POST http://localhost:8083/connectors \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "accessbank-nip-system-connector",
    "config": {
        "connector.class": "io.debezium.connector.oracle.OracleConnector",
        "tasks.max": "1",
        "database.hostname": "oracle-db",
        "database.port": "1521",
        "database.user": "C##DEBEZIUM",
        "database.password": "oracle",
        "database.dbname": "ACCESSBANK",
        "database.pdb.name": "ACCESSBANK",
        "topic.prefix": "accessbank-nip",
        "schema.include.list": "NIPSYSTEM",
        "table.include.list": "NIPSYSTEM.NIPX_DIRECT_CREDITS,NIPSYSTEM.NIPX_BANKS,NIPSYSTEM.NIPX_INBOUND_CREDITS",
        "schema.history.internal.kafka.bootstrap.servers": "kafka:9092",
        "schema.history.internal.kafka.topic": "schema-changes.accessbank-nip",
        "snapshot.mode": "initial",
        "log.mining.strategy": "online_catalog",
        "decimal.handling.mode": "double",
        "tombstones.on.delete": "true"
    }
}'