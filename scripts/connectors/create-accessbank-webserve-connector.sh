#!/bin/bash

curl -X POST http://localhost:8083/connectors \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "accessbank-webserve-connector",
    "config": {
        "connector.class": "io.debezium.connector.oracle.OracleConnector",
        "tasks.max": "1",
        "database.hostname": "oracle-db",
        "database.port": "1521",
        "database.user": "C##DEBEZIUM",
        "database.password": "oracle",
        "database.dbname": "ACCESSBANK",
        "database.pdb.name": "ACCESSBANK",
        "topic.prefix": "accessbank-webserve",
        "schema.include.list": "WEBSERVE",
        "table.include.list": "WEBSERVE.PAYMENT_ROUTER_TXN_LOG,WEBSERVE.CSTM_PRODUCT_INTERFACE_MAPPING",
        "schema.history.internal.kafka.bootstrap.servers": "kafka:9092",
        "schema.history.internal.kafka.topic": "schema-changes.accessbank-webserve",
        "snapshot.mode": "initial",
        "log.mining.strategy": "online_catalog",
        "decimal.handling.mode": "double",
        "tombstones.on.delete": "true"
    }
}'

# Note: Adjust the "schema.include.list" and "table.include.list" values as needed to capture the relevant tables for the webserve system.
