-- ============================================================================
-- CDC Transaction Generator for Access Bank Flexcube POV
-- ============================================================================
-- Generates randomized transactions across 3 schemas:
--   - ABFCUBSLIVE.ACZB_HISTORY (primary transaction ledger)
--   - NIPSYSTEM.NIPX_DIRECT_CREDITS (outgoing NIP)
--   - NIPSYSTEM.NIPX_INBOUND_CREDITS (incoming NIP)
--   - WEBSERVE.PAYMENT_ROUTER_TXN_LOG (payment router)
--
-- Usage:
--   For 10 transactions:   exec GENERATE_CDC_TRANSACTIONS(10);
--   For 100 transactions:  exec GENERATE_CDC_TRANSACTIONS(100);
--   For 1000 transactions: exec GENERATE_CDC_TRANSACTIONS(1000);
--
-- Prerequisites:
--   - Customers and accounts must already exist (cdc-seed-data-simulation.sql)
--   - NIPX_BANKS and CSTM_PRODUCT_INTERFACE_MAPPING must be seeded
--   - AC_ENTRY_SR_NO starts from 400000000001
--
-- Transaction Distribution (realistic):
--   60% Interbank NIP (30% outgoing RTFT, 30% incoming RTIN)
--   20% Intrabank (RTIB, RTMO, RTUS)
--   20% Standalone (Cash, ATM, POS, Salary, Fees)
--
-- Date Range: Last 30 days
-- ============================================================================

CREATE OR REPLACE PROCEDURE GENERATE_CDC_TRANSACTIONS(p_count IN NUMBER DEFAULT 1000)
AS
    -- Account pool
    TYPE t_accounts IS TABLE OF VARCHAR2(20);
    v_accounts t_accounts := t_accounts(
        '0011234501', '0021234502', '0031234503', '0011234504', '0021234505',
        '0031234506', '0011234507', '0021234508', '0031234509', '0011234510'
    );

    -- Branch mapping (derived from account prefix)
    TYPE t_branches IS TABLE OF VARCHAR2(3);
    v_branches t_branches := t_branches(
        '001', '002', '003', '001', '002',
        '003', '001', '002', '003', '001'
    );

    -- Customer mapping
    TYPE t_customers IS TABLE OF VARCHAR2(9);
    v_customers t_customers := t_customers(
        '100001', '100002', '100003', '100004', '100005',
        '100006', '100007', '100008', '100009', '100010'
    );

    -- Customer names for NIP
    TYPE t_names IS TABLE OF VARCHAR2(200);
    v_names t_names := t_names(
        'Adebayo Ogunlesi', 'Chioma Nwosu', 'Emeka Obiora', 'Funke Akindele', 'Ibrahim Musa',
        'Ngozi Okafor', 'Tunde Bakare', 'Amina Yusuf', 'Olumide Adeyemi', 'Blessing Eze'
    );

    -- External bank accounts (for NIP destinations)
    TYPE t_ext_accounts IS TABLE OF VARCHAR2(20);
    v_ext_accounts t_ext_accounts := t_ext_accounts(
        '2012345678', '3045678901', '5067891234', '1098765432', '4056789012',
        '8012345678', '9087654321', '6034567890', '7023456789', '2056781234'
    );

    -- External bank names
    v_ext_names t_names := t_names(
        'Chinedu Okoro', 'Fatima Abdullahi', 'Oluwaseun Balogun', 'Grace Nneka', 'Musa Abdullahi',
        'Temitope Adesanya', 'Yusuf Mohammed', 'Amaka Obi', 'Damilola Adekunle', 'Hauwa Ibrahim'
    );

    -- NIP bank codes (must exist in NIPX_BANKS)
    TYPE t_bank_codes IS TABLE OF VARCHAR2(20);
    v_bank_codes t_bank_codes := t_bank_codes(
        '000016', '000004', '000007', '000013', '000011',
        '000033', '000010', '000032', '000035', '000039',
        '000050', '000058', '000221', '090405', '090267',
        '100033', '100026'
    );

    -- Intrabank products
    TYPE t_products IS TABLE OF VARCHAR2(4);
    v_intra_products t_products := t_products('RTIB', 'RTMO', 'RTUS', 'RTAT');

    -- Standalone transaction types (parallel arrays)
    TYPE t_trn_codes IS TABLE OF VARCHAR2(3);
    TYPE t_modules IS TABLE OF VARCHAR2(2);
    v_sa_trn_codes t_trn_codes := t_trn_codes('001', '002', '900', '910', '920', '970', '501', '560');
    v_sa_modules   t_modules   := t_modules  ('AC',  'AC',  'AC',  'AC',  'AC',  'AC',  'IC',  'IC');

    -- Variables
    v_entry_sr_no    NUMBER;
    v_rand           NUMBER;
    v_acct_idx       PLS_INTEGER;
    v_dest_idx       PLS_INTEGER;
    v_bank_idx       PLS_INTEGER;
    v_amount         NUMBER;
    v_trn_dt         DATE;
    v_trn_ts         TIMESTAMP;
    v_ext_ref        VARCHAR2(40);
    v_trn_ref        VARCHAR2(20);
    v_session_id     VARCHAR2(100);
    v_drcr           CHAR(1);
    v_product        VARCHAR2(4);
    v_standalone_idx PLS_INTEGER;
    v_channel        VARCHAR2(20);
    v_narration      VARCHAR2(500);
    v_run_id         VARCHAR2(6);  -- unique per run to avoid PK collisions

BEGIN
    -- Generate a run-unique prefix from current timestamp (HHMMSS)
    v_run_id := TO_CHAR(SYSTIMESTAMP, 'HH24MISS');
    -- Start from current max to avoid PK violations on re-runs
    SELECT NVL(MAX(AC_ENTRY_SR_NO), 400000000000) INTO v_entry_sr_no FROM abfcubslive.ACZB_HISTORY;
    DBMS_OUTPUT.PUT_LINE('Starting AC_ENTRY_SR_NO from: ' || (v_entry_sr_no + 1));
    DBMS_OUTPUT.PUT_LINE('Generating ' || p_count || ' CDC transactions...');

    FOR i IN 1..p_count LOOP
        v_entry_sr_no := v_entry_sr_no + 1;
        v_rand := DBMS_RANDOM.VALUE(0, 100);
        v_acct_idx := TRUNC(DBMS_RANDOM.VALUE(1, 11));  -- 1-10
        v_trn_dt := TRUNC(SYSDATE) - TRUNC(DBMS_RANDOM.VALUE(0, 30));
        v_trn_ts := v_trn_dt + DBMS_RANDOM.VALUE(0, 1);  -- random time of day
        v_trn_ref := 'FT' || TO_CHAR(v_trn_dt, 'YYMMDD') || LPAD(i, 7, '0');

        -- ================================================================
        -- 30% NIP OUTGOING (RTFT) -> ACZB_HISTORY + NIPX_DIRECT_CREDITS + PAYMENT_ROUTER_TXN_LOG
        -- ================================================================
        IF v_rand < 30 THEN
            v_amount := TRUNC(DBMS_RANDOM.VALUE(5000, 5000000));
            v_bank_idx := TRUNC(DBMS_RANDOM.VALUE(1, v_bank_codes.COUNT + 1));
            v_dest_idx := TRUNC(DBMS_RANDOM.VALUE(1, 11));
            v_ext_ref := 'NIP-' || v_run_id || '-C' || v_acct_idx || '-' || LPAD(i, 7, '0');
            v_session_id := '000014' || TO_CHAR(v_trn_dt, 'YYMMDD') || LPAD(TRUNC(DBMS_RANDOM.VALUE(100000, 999999)), 6, '0');
            v_channel := CASE TRUNC(DBMS_RANDOM.VALUE(1, 5))
                            WHEN 1 THEN 'MOBILE'
                            WHEN 2 THEN 'INTERNET'
                            WHEN 3 THEN 'USSD'
                            ELSE 'BRANCH'
                         END;
            v_narration := 'Transfer to ' || v_ext_names(v_dest_idx) || ' - ' || v_channel;

            -- ACZB_HISTORY
            INSERT INTO abfcubslive.ACZB_HISTORY (
                AC_ENTRY_SR_NO, AC_NO, TRN_REF_NO, AC_CCY, DRCR_IND, TRN_CODE,
                FCY_AMOUNT, LCY_AMOUNT, TRN_DT, VALUE_DT, STMT_DT,
                MODULE, EVENT, EVENT_SR_NO, AC_BRANCH, PRODUCT,
                EXTERNAL_REF_NO, RELATED_ACCOUNT, AUTH_TIMESTAMP
            ) VALUES (
                v_entry_sr_no, v_accounts(v_acct_idx), v_trn_ref, 'NGN', 'D', '960',
                v_amount, v_amount, v_trn_dt, v_trn_dt, v_trn_dt,
                'RT', 'INIT', 1, v_branches(v_acct_idx), 'RTFT',
                v_ext_ref, v_ext_accounts(v_dest_idx), v_trn_ts
            );

            -- NIPX_DIRECT_CREDITS
            INSERT INTO nipsystem.NIPX_DIRECT_CREDITS (
                PAYMENT_REFERENCE, SESSION_ID, DEST_BANK_CODE, DEST_ACCOUNT,
                DEST_NAME, SOURCE_BANK_CODE, SOURCE_ACCOUNT, SOURCE_NAME,
                AMOUNT, CURRENCY, NARRATION, STATUS, CREATED_AT, UPDATED_AT
            ) VALUES (
                v_ext_ref, v_session_id, v_bank_codes(v_bank_idx), v_ext_accounts(v_dest_idx),
                v_ext_names(v_dest_idx), '000014', v_accounts(v_acct_idx), v_names(v_acct_idx),
                v_amount, 'NGN', v_narration, 'SUCCESS', v_trn_ts, v_trn_ts + INTERVAL '2' SECOND
            );

            -- PAYMENT_ROUTER_TXN_LOG
            INSERT INTO webserve.PAYMENT_ROUTER_TXN_LOG (
                MESSAGE_ID, CHANNEL, RECIPIENT_BANK, RECIPIENT_ACCOUNT,
                RECIPIENT_NAME, SENDER_ACCOUNT, SENDER_NAME,
                AMOUNT, CURRENCY, TRANSACTION_TYPE, STATUS, CREATED_AT, UPDATED_AT
            ) VALUES (
                v_ext_ref, v_channel, v_bank_codes(v_bank_idx), v_ext_accounts(v_dest_idx),
                v_ext_names(v_dest_idx), v_accounts(v_acct_idx), v_names(v_acct_idx),
                v_amount, 'NGN', 'NIP_OUTWARD', 'COMPLETED', v_trn_ts, v_trn_ts + INTERVAL '3' SECOND
            );

        -- ================================================================
        -- 30% NIP INCOMING (RTIN) -> ACZB_HISTORY + NIPX_INBOUND_CREDITS + PAYMENT_ROUTER_TXN_LOG
        -- ================================================================
        ELSIF v_rand < 60 THEN
            v_amount := TRUNC(DBMS_RANDOM.VALUE(1000, 10000000));
            v_bank_idx := TRUNC(DBMS_RANDOM.VALUE(1, v_bank_codes.COUNT + 1));
            v_dest_idx := TRUNC(DBMS_RANDOM.VALUE(1, 11));
            v_ext_ref := 'NIP-' || v_run_id || '-IN' || v_acct_idx || '-' || LPAD(i, 7, '0');
            v_session_id := v_bank_codes(v_bank_idx) || TO_CHAR(v_trn_dt, 'YYMMDD') || LPAD(TRUNC(DBMS_RANDOM.VALUE(100000, 999999)), 6, '0');
            v_narration := 'Credit from ' || v_ext_names(v_dest_idx) || ' via NIP';

            -- ACZB_HISTORY
            INSERT INTO abfcubslive.ACZB_HISTORY (
                AC_ENTRY_SR_NO, AC_NO, TRN_REF_NO, AC_CCY, DRCR_IND, TRN_CODE,
                FCY_AMOUNT, LCY_AMOUNT, TRN_DT, VALUE_DT, STMT_DT,
                MODULE, EVENT, EVENT_SR_NO, AC_BRANCH, PRODUCT,
                EXTERNAL_REF_NO, AUTH_TIMESTAMP
            ) VALUES (
                v_entry_sr_no, v_accounts(v_acct_idx), v_trn_ref, 'NGN', 'C', '009',
                v_amount, v_amount, v_trn_dt, v_trn_dt, v_trn_dt,
                'RT', 'INIT', 1, v_branches(v_acct_idx), 'RTIN',
                v_ext_ref, v_trn_ts
            );

            -- NIPX_INBOUND_CREDITS
            INSERT INTO nipsystem.NIPX_INBOUND_CREDITS (
                PAYMENT_REFERENCE, SESSION_ID, SOURCE_BANK_CODE, SOURCE_ACCOUNT,
                SOURCE_NAME, DEST_ACCOUNT, DEST_NAME,
                AMOUNT, NARRATION, STATUS, CREATED_AT
            ) VALUES (
                v_ext_ref, v_session_id, v_bank_codes(v_bank_idx), v_ext_accounts(v_dest_idx),
                v_ext_names(v_dest_idx), v_accounts(v_acct_idx), v_names(v_acct_idx),
                v_amount, v_narration, 'CREDITED', v_trn_ts
            );

            -- PAYMENT_ROUTER_TXN_LOG
            INSERT INTO webserve.PAYMENT_ROUTER_TXN_LOG (
                MESSAGE_ID, CHANNEL, RECIPIENT_BANK, RECIPIENT_ACCOUNT,
                RECIPIENT_NAME, SENDER_ACCOUNT, SENDER_NAME,
                AMOUNT, CURRENCY, TRANSACTION_TYPE, STATUS, CREATED_AT, UPDATED_AT
            ) VALUES (
                v_ext_ref, 'NIP', '000014', v_accounts(v_acct_idx),
                v_names(v_acct_idx), v_ext_accounts(v_dest_idx), v_ext_names(v_dest_idx),
                v_amount, 'NGN', 'NIP_INWARD', 'COMPLETED', v_trn_ts, v_trn_ts + INTERVAL '1' SECOND
            );

        -- ================================================================
        -- 20% INTRABANK (RTIB/RTMO/RTUS/RTAT) -> ACZB_HISTORY + PAYMENT_ROUTER_TXN_LOG
        -- ================================================================
        ELSIF v_rand < 80 THEN
            v_amount := TRUNC(DBMS_RANDOM.VALUE(1000, 2000000));
            -- Pick a different account as destination
            v_dest_idx := v_acct_idx;
            WHILE v_dest_idx = v_acct_idx LOOP
                v_dest_idx := TRUNC(DBMS_RANDOM.VALUE(1, 11));
            END LOOP;
            v_product := v_intra_products(TRUNC(DBMS_RANDOM.VALUE(1, 5)));
            v_ext_ref := 'MSG-' || v_run_id || '-C' || v_acct_idx || '-' || LPAD(i, 7, '0');
            v_channel := CASE v_product
                            WHEN 'RTMO' THEN 'MOBILE'
                            WHEN 'RTUS' THEN 'USSD'
                            WHEN 'RTAT' THEN 'ATM'
                            ELSE 'INTERNET'
                         END;
            v_drcr := 'D';

            -- ACZB_HISTORY (debit leg)
            INSERT INTO abfcubslive.ACZB_HISTORY (
                AC_ENTRY_SR_NO, AC_NO, TRN_REF_NO, AC_CCY, DRCR_IND, TRN_CODE,
                FCY_AMOUNT, LCY_AMOUNT, TRN_DT, VALUE_DT, STMT_DT,
                MODULE, EVENT, EVENT_SR_NO, AC_BRANCH, PRODUCT,
                RELATED_ACCOUNT, EXTERNAL_REF_NO, AUTH_TIMESTAMP
            ) VALUES (
                v_entry_sr_no, v_accounts(v_acct_idx), v_trn_ref, 'NGN', 'D',
                CASE v_product WHEN 'RTUS' THEN '950' WHEN 'RTMO' THEN '960' ELSE '100' END,
                v_amount, v_amount, v_trn_dt, v_trn_dt, v_trn_dt,
                'RT', 'INIT', 1, v_branches(v_acct_idx), v_product,
                v_accounts(v_dest_idx), v_ext_ref, v_trn_ts
            );

            -- PAYMENT_ROUTER_TXN_LOG
            INSERT INTO webserve.PAYMENT_ROUTER_TXN_LOG (
                MESSAGE_ID, CHANNEL, RECIPIENT_BANK, RECIPIENT_ACCOUNT,
                RECIPIENT_NAME, SENDER_ACCOUNT, SENDER_NAME,
                AMOUNT, CURRENCY, TRANSACTION_TYPE, STATUS, CREATED_AT, UPDATED_AT
            ) VALUES (
                v_ext_ref, v_channel, '000014', v_accounts(v_dest_idx),
                v_names(v_dest_idx), v_accounts(v_acct_idx), v_names(v_acct_idx),
                v_amount, 'NGN', 'INTRABANK', 'COMPLETED', v_trn_ts, v_trn_ts + INTERVAL '1' SECOND
            );

        -- ================================================================
        -- 20% STANDALONE (Cash, ATM, POS, Salary, Fees) -> ACZB_HISTORY only
        -- ================================================================
        ELSE
            v_standalone_idx := TRUNC(DBMS_RANDOM.VALUE(1, v_sa_trn_codes.COUNT + 1));
            v_amount := CASE v_sa_trn_codes(v_standalone_idx)
                            WHEN '001' THEN TRUNC(DBMS_RANDOM.VALUE(50000, 5000000))   -- Cash deposit
                            WHEN '002' THEN TRUNC(DBMS_RANDOM.VALUE(10000, 500000))    -- Cash withdrawal
                            WHEN '900' THEN TRUNC(DBMS_RANDOM.VALUE(5000, 200000))     -- ATM
                            WHEN '910' THEN TRUNC(DBMS_RANDOM.VALUE(500, 500000))      -- POS
                            WHEN '920' THEN TRUNC(DBMS_RANDOM.VALUE(1000, 1000000))    -- Web
                            WHEN '970' THEN TRUNC(DBMS_RANDOM.VALUE(150000, 3000000))  -- Salary
                            WHEN '501' THEN TRUNC(DBMS_RANDOM.VALUE(100, 50000))       -- Interest
                            WHEN '560' THEN TRUNC(DBMS_RANDOM.VALUE(50, 500))          -- Fees
                            ELSE TRUNC(DBMS_RANDOM.VALUE(1000, 100000))
                        END;

            -- Determine debit/credit based on transaction type
            v_drcr := CASE v_sa_trn_codes(v_standalone_idx)
                          WHEN '001' THEN 'C'  -- Cash Deposit = Credit
                          WHEN '970' THEN 'C'  -- Salary = Credit
                          WHEN '501' THEN 'C'  -- Interest = Credit
                          ELSE 'D'             -- Everything else = Debit
                      END;

            INSERT INTO abfcubslive.ACZB_HISTORY (
                AC_ENTRY_SR_NO, AC_NO, TRN_REF_NO, AC_CCY, DRCR_IND, TRN_CODE,
                FCY_AMOUNT, LCY_AMOUNT, TRN_DT, VALUE_DT, STMT_DT,
                MODULE, EVENT, EVENT_SR_NO, AC_BRANCH, AUTH_TIMESTAMP
            ) VALUES (
                v_entry_sr_no, v_accounts(v_acct_idx), v_trn_ref, 'NGN',
                v_drcr, v_sa_trn_codes(v_standalone_idx),
                v_amount, v_amount, v_trn_dt, v_trn_dt, v_trn_dt,
                v_sa_modules(v_standalone_idx), 'INIT', 1,
                v_branches(v_acct_idx), v_trn_ts
            );
        END IF;

        -- Commit every 100 records
        IF MOD(i, 100) = 0 THEN
            COMMIT;
            DBMS_OUTPUT.PUT_LINE('  Inserted ' || i || ' / ' || p_count || ' transactions');
        END IF;
    END LOOP;

    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Done. Generated ' || p_count || ' transactions.');
    DBMS_OUTPUT.PUT_LINE('  AC_ENTRY_SR_NO range: 400000000001 - ' || v_entry_sr_no);
    DBMS_OUTPUT.PUT_LINE('  Date range: ' || TO_CHAR(TRUNC(SYSDATE) - 30, 'YYYY-MM-DD') || ' to ' || TO_CHAR(TRUNC(SYSDATE), 'YYYY-MM-DD'));
END;
/


-- ============================================================================
-- EXECUTE: Generate transactions
-- Uncomment the desired line below and run:
-- ============================================================================

-- Generate 10 transactions:
-- BEGIN
--     GENERATE_CDC_TRANSACTIONS(90);
-- END;

-- Generate 100 transactions:
-- BEGIN
--     GENERATE_CDC_TRANSACTIONS(100);
-- END;

-- Generate 1000 transactions:
-- BEGIN
--     GENERATE_CDC_TRANSACTIONS(1000);
-- END;
