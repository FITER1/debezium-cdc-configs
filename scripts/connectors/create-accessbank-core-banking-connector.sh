#!/bin/bash

curl -X POST http://localhost:8083/connectors \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "accessbank-core-banking-connector",
    "config": {
        "connector.class": "io.debezium.connector.oracle.OracleConnector",
        "tasks.max": "1",
        "database.hostname": "oracle-db",
        "database.port": "1521",
        "database.user": "C##DEBEZIUM",
        "database.password": "oracle",
        "database.dbname": "ACCESSBANK",
        "database.pdb.name": "ACCESSBANK",
        "topic.prefix": "accessbank-core",
        "schema.include.list": "ABFCUBSLIVE",
        "table.include.list": "ABFCUBSLIVE.ACZB_HISTORY,ABFCUBSLIVE.ACZB_DAILY_LOG,ABFCUBSLIVE.STZM_CUST_ACCOUNT,ABFCUBSLIVE.STZM_CUSTOMER,ABFCUBSLIVE.STZM_TRN_CODE",
        "schema.history.internal.kafka.bootstrap.servers": "kafka:29092",
        "schema.history.internal.kafka.topic": "schema-changes.accessbank-core",
        "snapshot.mode": "initial",
        "log.mining.strategy": "online_catalog",
        "decimal.handling.mode": "double",
        "tombstones.on.delete": "true",
        "include.schema.changes": "true",
        "transforms": "filter",
        "transforms.filter.type": "io.debezium.transforms.Filter",
        "transforms.filter.language": "jsr223.groovy",
        "transforms.filter.condition": "import java.util.HashSet; def accounts = new HashSet(Arrays.asList('\''0011234501'\'','\''0021234502T'\'','\''0031234503T'\'','\''0011234504T'\'')); def customers = new HashSet(Arrays.asList('\''100001'\'','\''100002T'\'','\''100003T'\'','\''100004T'\'')); if (value == null) { return true }; def src = value.get(''source''); def tbl = src != null ? src.get(''table'') : ''''; if (tbl == ''STZM_TRN_CODE'') { return true }; def r = null; try { r = value.get(''after'') } catch(Exception e) { }; if (r == null) { try { r = value.get(''before'') } catch(Exception e) { } }; if (r == null) { return true }; if (tbl == ''STZM_CUSTOMER'') { def c = null; try { c = r.get(''CUSTOMER_NO'') } catch(Exception e) { }; return c != null && customers.contains(c.toString()) }; def v = null; try { v = r.get(''CUST_AC_NO'') } catch(Exception e) { }; if (v == null) { try { v = r.get(''AC_NO'') } catch(Exception e) { } }; if (v == null) { return true }; return accounts.contains(v.toString())",
        "transforms.filter.null.handling.mode": "keep"
    }
}'