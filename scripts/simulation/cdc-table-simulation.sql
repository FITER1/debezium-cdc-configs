
-- ABFCUBSLIVE: CDC-Streamed Tables
--------------------------------------------------------------------------

-- ACZB_DAILY_LOG (intraday ledger — populated immediately on transaction)
CREATE TABLE abfcubslive.ACZB_DAILY_LOG (
    MODULE              VARCHAR2(2),
    TRN_REF_NO          VARCHAR2(16),
    EVENT_SR_NO          NUMBER,
    EVENT                VARCHAR2(4),
    AC_ENTRY_SR_NO       NUMBER,
    AC_BRANCH            VARCHAR2(3),
    AC_NO                VARCHAR2(20),
    AC_CCY               VARCHAR2(3),
    DRCR_IND             CHAR(1),
    TRN_CODE             VARCHAR2(3),
    AMOUNT_TAG           VARCHAR2(35),
    FCY_AMOUNT           NUMBER,
    EXCH_RATE            NUMBER(24,12),
    LCY_AMOUNT           NUMBER,
    RELATED_CUSTOMER     VARCHAR2(9),
    RELATED_ACCOUNT      VARCHAR2(20),
    RELATED_REFERENCE    VARCHAR2(16),
    TRN_DT               DATE,
    VALUE_DT             DATE,
    TXN_INIT_DATE        DATE,
    FINANCIAL_CYCLE      VARCHAR2(9),
    PERIOD_CODE          VARCHAR2(3),
    INSTRUMENT_CODE      VARCHAR2(16),
    BATCH_NO             VARCHAR2(4),
    CURR_NO              NUMBER(6,0),
    USER_ID              VARCHAR2(12),
    BANK_CODE            VARCHAR2(12),
    AUTH_ID              VARCHAR2(12),
    AUTH_STAT            CHAR(1),
    TYPE                 CHAR(1),
    CATEGORY             CHAR(1),
    CUST_GL              CHAR(1),
    PRODUCT              VARCHAR2(4),
    EXTERNAL_REF_NO      VARCHAR2(35),
    DONT_SHOWIN_STMT     CHAR(1),
    STMT_DT              DATE,
    ENTRY_SEQ_NO         NUMBER,
    SAVE_TIMESTAMP       TIMESTAMP(6),
    AUTH_TIMESTAMP       TIMESTAMP(6),
    GRP_REF_NO           VARCHAR2(35),
    RELATED_AC_ENTRY_SR_NO NUMBER,
    SOURCE_CODE          VARCHAR2(15),
    PRODUCT_PROCESSOR    VARCHAR2(2) DEFAULT 'FC',
    CONSTRAINT PK_ACZB_DAILY_LOG PRIMARY KEY (AC_ENTRY_SR_NO)
);


-- ACZB_HISTORY (post-EOD finalized transactions)
CREATE TABLE abfcubslive.ACZB_HISTORY (
    TRN_REF_NO          VARCHAR2(16),
    EVENT_SR_NO          NUMBER,
    EVENT                VARCHAR2(4),
    AC_BRANCH            VARCHAR2(3),
    AC_NO                VARCHAR2(20),
    AC_CCY               VARCHAR2(3),
    DRCR_IND             CHAR(1),
    TRN_CODE             VARCHAR2(3),
    AMOUNT_TAG           VARCHAR2(35),
    FCY_AMOUNT           NUMBER,
    EXCH_RATE            NUMBER(24,12),
    LCY_AMOUNT           NUMBER,
    RELATED_CUSTOMER     VARCHAR2(9),
    RELATED_ACCOUNT      VARCHAR2(20),
    RELATED_REFERENCE    VARCHAR2(16),
    TRN_DT               DATE,
    VALUE_DT             DATE,
    TXN_INIT_DATE        DATE,
    FINANCIAL_CYCLE      VARCHAR2(9),
    PERIOD_CODE          VARCHAR2(3),
    INSTRUMENT_CODE      VARCHAR2(16),
    BANK_CODE            VARCHAR2(12),
    TYPE                 CHAR(1),
    CATEGORY             CHAR(1),
    CUST_GL              CHAR(1),
    MODULE               VARCHAR2(2),
    AC_ENTRY_SR_NO       NUMBER,
    USER_ID              VARCHAR2(12),
    CURR_NO              NUMBER(6,0),
    BATCH_NO             VARCHAR2(4),
    AUTH_ID              VARCHAR2(12),
    PRODUCT              VARCHAR2(4),
    EXTERNAL_REF_NO      VARCHAR2(35),
    DONT_SHOWIN_STMT     CHAR(1),
    STMT_DT              DATE,
    ENTRY_SEQ_NO         NUMBER,
    SAVE_TIMESTAMP       TIMESTAMP(6),
    AUTH_TIMESTAMP       TIMESTAMP(6),
    GRP_REF_NO           VARCHAR2(35),
    RELATED_AC_ENTRY_SR_NO NUMBER,
    SOURCE_CODE          VARCHAR2(15),
    PRODUCT_PROCESSOR    VARCHAR2(2),
    CONSTRAINT PK_ACZB_HISTORY PRIMARY KEY (AC_ENTRY_SR_NO)
);

-- STZM_CUST_ACCOUNT (account master)
CREATE TABLE abfcubslive.STZM_CUST_ACCOUNT (
    BRANCH_CODE          VARCHAR2(3),
    CUST_AC_NO           VARCHAR2(20),
    AC_DESC              VARCHAR2(105),
    CUST_NO              VARCHAR2(9),
    CCY                  VARCHAR2(3),
    ACCOUNT_CLASS        VARCHAR2(6),
    AC_STAT_NO_DR        CHAR(1) DEFAULT 'N',
    AC_STAT_NO_CR        CHAR(1) DEFAULT 'N',
    AC_STAT_FROZEN       CHAR(1) DEFAULT 'N',
    AC_STAT_DORMANT      CHAR(1) DEFAULT 'N',
    AC_STAT_BLOCK        CHAR(1) DEFAULT 'N',
    AC_STAT_DE_POST      CHAR(1),
    RECORD_STAT          CHAR(1) DEFAULT 'O',
    AUTH_STAT            CHAR(1) DEFAULT 'U',
    AC_OPEN_DATE         DATE,
    ACY_OPENING_BAL      NUMBER DEFAULT 0,
    ACY_CURR_BALANCE     NUMBER DEFAULT 0,
    ALT_AC_NO            VARCHAR2(35),
    MAKER_ID             VARCHAR2(12),
    MAKER_DT_STAMP       DATE,
    CHECKER_ID           VARCHAR2(12),
    CHECKER_DT_STAMP     DATE,
    CONSTRAINT PK_STZM_CUST_ACCOUNT PRIMARY KEY (CUST_AC_NO)
);

-- STZM_CUSTOMER (customer master)
CREATE TABLE abfcubslive.STZM_CUSTOMER (
    CUSTOMER_NO          VARCHAR2(9),
    CUSTOMER_TYPE        CHAR(1),
    CUSTOMER_NAME1       VARCHAR2(105),
    SHORT_NAME           VARCHAR2(20),
    FULL_NAME            VARCHAR2(105),
    NATIONALITY          VARCHAR2(3),
    COUNTRY              VARCHAR2(3),
    LOCAL_BRANCH         VARCHAR2(3),
    FROZEN               CHAR(1),
    DECEASED             CHAR(1),
    RECORD_STAT          CHAR(1),
    AUTH_STAT            CHAR(1),
    CIF_CREATION_DATE    DATE,
    CONSTRAINT PK_STZM_CUSTOMER PRIMARY KEY (CUSTOMER_NO)
);


-- STZM_TRN_CODE (transaction code descriptions)
CREATE TABLE abfcubslive.STZM_TRN_CODE (
    TRN_CODE             VARCHAR2(3),
    TRN_DESC             VARCHAR2(255),
    TRN_SWIFT_CODE       VARCHAR2(3),
    RECORD_STAT          CHAR(1) DEFAULT 'O',
    AUTH_STAT            CHAR(1) DEFAULT 'U',
    CONSTRAINT PK_STZM_TRN_CODE PRIMARY KEY (TRN_CODE)
);


--  NIPSYSTEM: Tables (Debezium-streamed)
-------------------------------------------------------------------------

-- NIPX_DIRECT_CREDITS (outgoing NIP transfers)
CREATE TABLE nipsystem.NIPX_DIRECT_CREDITS (
    PAYMENT_REFERENCE    VARCHAR2(100),
    SESSION_ID           VARCHAR2(100),
    DEST_BANK_CODE       VARCHAR2(20),
    DEST_ACCOUNT         VARCHAR2(20),
    DEST_NAME            VARCHAR2(200),
    SOURCE_BANK_CODE     VARCHAR2(20),
    SOURCE_ACCOUNT       VARCHAR2(20),
    SOURCE_NAME          VARCHAR2(200),
    AMOUNT               NUMBER,
    CURRENCY             VARCHAR2(5),
    NARRATION            VARCHAR2(500),
    STATUS               VARCHAR2(20),
    CREATED_AT           TIMESTAMP,
    UPDATED_AT           TIMESTAMP,
    CONSTRAINT PK_NIPX_DIRECT_CREDITS PRIMARY KEY (PAYMENT_REFERENCE)
);


-- NIPX_INBOUND_CREDITS (incoming NIP transfers)
CREATE TABLE nipsystem.NIPX_INBOUND_CREDITS (
    PAYMENT_REFERENCE    VARCHAR2(100),
    SESSION_ID           VARCHAR2(100),
    SOURCE_BANK_CODE     VARCHAR2(20),
    SOURCE_ACCOUNT       VARCHAR2(20),
    SOURCE_NAME          VARCHAR2(200),
    DEST_ACCOUNT         VARCHAR2(20),
    DEST_NAME            VARCHAR2(200),
    AMOUNT               NUMBER,
    NARRATION            VARCHAR2(500),
    STATUS               VARCHAR2(20),
    CREATED_AT           TIMESTAMP,
    CONSTRAINT PK_NIPX_INBOUND_CREDITS PRIMARY KEY (PAYMENT_REFERENCE)
);

-- NIPX_BANKS (bank directory)
CREATE TABLE nipsystem.NIPX_BANKS (
    CODE                 VARCHAR2(20),
    BANK_NAME            VARCHAR2(200),
    CBN_CODE             VARCHAR2(20),
    CONSTRAINT PK_NIPX_BANKS PRIMARY KEY (CODE)
);

CREATE INDEX IDX_NIPX_BANKS_CBN ON nipsystem.NIPX_BANKS (CBN_CODE);


--  WEBSERVE: Tables (Debezium-streamed)
----------------------------------------------------

-- PAYMENT_ROUTER_TXN_LOG
CREATE TABLE webserve.PAYMENT_ROUTER_TXN_LOG (
    MESSAGE_ID           VARCHAR2(100),
    CHANNEL              VARCHAR2(20),
    RECIPIENT_BANK       VARCHAR2(20),
    RECIPIENT_ACCOUNT    VARCHAR2(20),
    RECIPIENT_NAME       VARCHAR2(200),
    SENDER_ACCOUNT       VARCHAR2(20),
    SENDER_NAME          VARCHAR2(200),
    AMOUNT               NUMBER,
    CURRENCY             VARCHAR2(5),
    TRANSACTION_TYPE     VARCHAR2(20),
    STATUS               VARCHAR2(20),
    CREATED_AT           TIMESTAMP,
    UPDATED_AT           TIMESTAMP,
    CONSTRAINT PK_PAYMENT_ROUTER_TXN_LOG PRIMARY KEY (MESSAGE_ID)
);


-- CSTM_PRODUCT_INTERFACE_MAPPING
CREATE TABLE webserve.CSTM_PRODUCT_INTERFACE_MAPPING (
    PRODUCT_CODE         VARCHAR2(20),
    PRODUCT_GROUP        VARCHAR2(20),
    CONSTRAINT PK_CSTM_PROD_IFACE_MAP PRIMARY KEY (PRODUCT_CODE, PRODUCT_GROUP)
);



