----------------------------------------------------------------------------------
-- XStream Outbound Server Setup for Access Bank CDC
-- Run as SYS on the Oracle 19c Enterprise database (CDB root)
-- Prerequisites: GoldenGate license (enables XStream), ARCHIVELOG mode
----------------------------------------------------------------------------------

-- Step 1: Enable GoldenGate replication (required for XStream)
ALTER SYSTEM SET enable_goldengate_replication = TRUE SCOPE=BOTH;

----------------------------------------------------------------------------------
-- Step 2: Create or update the CDC user (C##CDC)
ALTER SESSION SET CONTAINER = CDB$ROOT;

-- Create user if not exists
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM dba_users WHERE username = 'C##CDC';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE USER C##CDC IDENTIFIED BY "<REPLACE_PASSWORD>" CONTAINER=ALL';
  ELSE
    EXECUTE IMMEDIATE 'ALTER USER C##CDC IDENTIFIED BY "<REPLACE_PASSWORD>" ACCOUNT UNLOCK';
  END IF;
END;
/

----------------------------------------------------------------------------------
-- Step 3: Grant XStream privileges to C##CDC
ALTER SESSION SET CONTAINER = CDB$ROOT;

-- Basic session and object privileges
GRANT CREATE SESSION TO C##CDC CONTAINER=ALL;
GRANT SET CONTAINER TO C##CDC CONTAINER=ALL;
GRANT SELECT ON V_$DATABASE TO C##CDC CONTAINER=ALL;
GRANT FLASHBACK ANY TABLE TO C##CDC CONTAINER=ALL;
GRANT SELECT ANY TABLE TO C##CDC CONTAINER=ALL;
GRANT SELECT_CATALOG_ROLE TO C##CDC CONTAINER=ALL;
GRANT EXECUTE_CATALOG_ROLE TO C##CDC CONTAINER=ALL;
GRANT SELECT ANY TRANSACTION TO C##CDC CONTAINER=ALL;
GRANT CREATE TABLE TO C##CDC CONTAINER=ALL;
GRANT LOCK ANY TABLE TO C##CDC CONTAINER=ALL;
GRANT UNLIMITED TABLESPACE TO C##CDC CONTAINER=ALL;

-- XStream-specific package grants
GRANT EXECUTE ON DBMS_XSTREAM_ADM TO C##CDC;
GRANT EXECUTE ON DBMS_XSTREAM_AUTH TO C##CDC;
GRANT EXECUTE ON DBMS_GG_ADM TO C##CDC;

-- Authorize XStream admin privilege (Capture + Apply)
BEGIN
  DBMS_XSTREAM_AUTH.GRANT_ADMIN_PRIVILEGE(
    grantee                 => 'C##CDC',
    privilege_type          => 'CAPTURE',
    grant_select_privileges => TRUE,
    container               => 'ALL'
  );
END;
/

----------------------------------------------------------------------------------
-- Step 4: Enable table-level supplemental logging (required for CDC)
-- NOTE: Do NOT enable database-level supplemental logging on production.
--       Table-level only to avoid redo volume increase.
ALTER SESSION SET CONTAINER = <PDB_NAME>;  -- Replace with actual PDB name

ALTER TABLE ABFCUBSLIVE.ACZB_HISTORY           ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;
ALTER TABLE ABFCUBSLIVE.ACZB_DAILY_LOG         ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;
ALTER TABLE ABFCUBSLIVE.STZM_CUST_ACCOUNT      ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;
ALTER TABLE ABFCUBSLIVE.STZM_TRN_CODE          ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;
ALTER TABLE ABFCUBSLIVE.STZM_CUSTOMER          ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;
ALTER TABLE NIPSYSTEM.NIPX_DIRECT_CREDITS      ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;
ALTER TABLE NIPSYSTEM.NIPX_BANKS               ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;
ALTER TABLE NIPSYSTEM.NIPX_INBOUND_CREDITS     ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;
ALTER TABLE WEBSERVE.PAYMENT_ROUTER_TXN_LOG    ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;
ALTER TABLE WEBSERVE.CSTM_PRODUCT_INTERFACE_MAPPING ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;

----------------------------------------------------------------------------------
-- Step 5: Create XStream Outbound Server
-- This creates: Capture Process + Queue + Outbound Server in one call.
-- Table filtering is configured here — only these 10 tables are captured.
ALTER SESSION SET CONTAINER = CDB$ROOT;

BEGIN
  DBMS_XSTREAM_ADM.CREATE_OUTBOUND(
    server_name           => 'DBZXOUT',
    source_database       => NULL,
    table_names           => '<PDB_NAME>.ABFCUBSLIVE.ACZB_HISTORY,'         ||
                             '<PDB_NAME>.ABFCUBSLIVE.ACZB_DAILY_LOG,'       ||
                             '<PDB_NAME>.ABFCUBSLIVE.STZM_CUST_ACCOUNT,'    ||
                             '<PDB_NAME>.ABFCUBSLIVE.STZM_TRN_CODE,'        ||
                             '<PDB_NAME>.ABFCUBSLIVE.STZM_CUSTOMER,'        ||
                             '<PDB_NAME>.NIPSYSTEM.NIPX_DIRECT_CREDITS,'    ||
                             '<PDB_NAME>.NIPSYSTEM.NIPX_BANKS,'             ||
                             '<PDB_NAME>.NIPSYSTEM.NIPX_INBOUND_CREDITS,'   ||
                             '<PDB_NAME>.WEBSERVE.PAYMENT_ROUTER_TXN_LOG,'  ||
                             '<PDB_NAME>.WEBSERVE.CSTM_PRODUCT_INTERFACE_MAPPING',
    source_container_name => '<PDB_NAME>',
    connect_user          => 'C##CDC'
  );
END;
/

----------------------------------------------------------------------------------
-- Step 6 (Optional): Add row-level subset rules
-- This replaces the Groovy SMT filter — Oracle filters rows before sending.
-- Uncomment and adjust if account-level filtering is needed at capture level.

-- BEGIN
--   DBMS_XSTREAM_ADM.ADD_SUBSET_RULES(
--     server_name => 'DBZXOUT',
--     table_name  => '<PDB_NAME>.ABFCUBSLIVE.ACZB_HISTORY',
--     condition   => 'TO_NUMBER(SUBSTR(AC_NO, 4)) BETWEEN 1 AND 5000',
--     operation   => NULL  -- NULL = INSERT + UPDATE + DELETE
--   );
-- END;
-- /

----------------------------------------------------------------------------------
-- Step 7: Verify setup

-- Check Outbound Server status
SELECT SERVER_NAME, STATUS, CONNECT_USER, CAPTURE_NAME
FROM DBA_XSTREAM_OUTBOUND;

-- Check Capture Process status
SELECT CAPTURE_NAME, STATUS, CAPTURED_SCN, APPLIED_SCN, STATE
FROM DBA_CAPTURE;

-- Check rules (should show your 10 tables)
SELECT STREAMS_NAME, RULE_NAME, SUBSETTING_OPERATION, RULE_CONDITION
FROM DBA_XSTREAM_RULES
WHERE STREAMS_NAME = 'DBZXOUT'
ORDER BY RULE_NAME;

-- Check Streams Pool allocation
SELECT COMPONENT, CURRENT_SIZE/1024/1024 AS SIZE_MB
FROM V$SGA_DYNAMIC_COMPONENTS
WHERE COMPONENT = 'streams pool';

----------------------------------------------------------------------------------
-- Useful management commands:

-- Stop outbound server
-- BEGIN DBMS_XSTREAM_ADM.STOP_OUTBOUND('DBZXOUT'); END;
-- /

-- Start outbound server
-- BEGIN DBMS_XSTREAM_ADM.START_OUTBOUND('DBZXOUT'); END;
-- /

-- Drop outbound server (removes Capture + Queue too)
-- BEGIN DBMS_XSTREAM_ADM.DROP_OUTBOUND('DBZXOUT'); END;
-- /

-- Monitor queue depth
-- SELECT QUEUE_NAME, NUM_MSGS, SPILL_MSGS FROM V$BUFFERED_QUEUES;
