-- STZM_TRN_CODE (Transaction Codes — Reference)
INSERT INTO abfcubslive.STZM_TRN_CODE (TRN_CODE, TRN_DESC, RECORD_STAT, AUTH_STAT) VALUES ('001', 'Cash Deposit', 'O', 'A');
INSERT INTO abfcubslive.STZM_TRN_CODE (TRN_CODE, TRN_DESC, RECORD_STAT, AUTH_STAT) VALUES ('002', 'Cash Withdrawal', 'O', 'A');
INSERT INTO abfcubslive.STZM_TRN_CODE (TRN_CODE, TRN_DESC, RECORD_STAT, AUTH_STAT) VALUES ('003', 'Cheque Deposit', 'O', 'A');
INSERT INTO abfcubslive.STZM_TRN_CODE (TRN_CODE, TRN_DESC, RECORD_STAT, AUTH_STAT) VALUES ('009', 'Funds Transfer', 'O', 'A');
INSERT INTO abfcubslive.STZM_TRN_CODE (TRN_CODE, TRN_DESC, RECORD_STAT, AUTH_STAT) VALUES ('010', 'Standing Order', 'O', 'A');
INSERT INTO abfcubslive.STZM_TRN_CODE (TRN_CODE, TRN_DESC, RECORD_STAT, AUTH_STAT) VALUES ('100', 'Account Transfer', 'O', 'A');
INSERT INTO abfcubslive.STZM_TRN_CODE (TRN_CODE, TRN_DESC, RECORD_STAT, AUTH_STAT) VALUES ('501', 'Interest Credit', 'O', 'A');
INSERT INTO abfcubslive.STZM_TRN_CODE (TRN_CODE, TRN_DESC, RECORD_STAT, AUTH_STAT) VALUES ('510', 'Interest Debit', 'O', 'A');
INSERT INTO abfcubslive.STZM_TRN_CODE (TRN_CODE, TRN_DESC, RECORD_STAT, AUTH_STAT) VALUES ('560', 'Account Maintenance Fee', 'O', 'A');
INSERT INTO abfcubslive.STZM_TRN_CODE (TRN_CODE, TRN_DESC, RECORD_STAT, AUTH_STAT) VALUES ('900', 'ATM Withdrawal', 'O', 'A');
INSERT INTO abfcubslive.STZM_TRN_CODE (TRN_CODE, TRN_DESC, RECORD_STAT, AUTH_STAT) VALUES ('910', 'POS Purchase', 'O', 'A');
INSERT INTO abfcubslive.STZM_TRN_CODE (TRN_CODE, TRN_DESC, RECORD_STAT, AUTH_STAT) VALUES ('920', 'Web Purchase', 'O', 'A');
INSERT INTO abfcubslive.STZM_TRN_CODE (TRN_CODE, TRN_DESC, RECORD_STAT, AUTH_STAT) VALUES ('950', 'USSD Transfer', 'O', 'A');
INSERT INTO abfcubslive.STZM_TRN_CODE (TRN_CODE, TRN_DESC, RECORD_STAT, AUTH_STAT) VALUES ('960', 'Mobile App Transfer', 'O', 'A');
INSERT INTO abfcubslive.STZM_TRN_CODE (TRN_CODE, TRN_DESC, RECORD_STAT, AUTH_STAT) VALUES ('970', 'Salary Credit', 'O', 'A');


-- NIPX_BANKS (Nigerian Bank Directory)
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('000014', 'Access Bank Plc', '00000149');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('000016', 'Zenith Bank Plc', '00000169');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('000004', 'United Bank for Africa', '00000049');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('000007', 'Fidelity Bank Plc', '00000079');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('000013', 'GTBank Plc', '00000139');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('000011', 'First Bank of Nigeria', '00000119');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('000033', 'Stanbic IBTC Bank', '00000339');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('000010', 'Ecobank Nigeria', '00000109');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('000023', 'Citibank Nigeria', '00000239');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('000032', 'Union Bank of Nigeria', '00000329');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('000035', 'Wema Bank Plc', '00000359');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('000039', 'Keystone Bank', '00000399');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('000050', 'Polaris Bank', '00000509');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('000058', 'Sterling Bank', '00000589');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('000215', 'Unity Bank Plc', '00002159');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('000221', 'FCMB Plc', '00002219');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('090405', 'Moniepoint MFB', '09040509');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('090267', 'Kuda MFB', '09026709');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('100033', 'OPay', '10003309');
INSERT INTO nipsystem.NIPX_BANKS (CODE, BANK_NAME, CBN_CODE) VALUES ('100026', 'PalmPay', '10002609');


-- CSTM_PRODUCT_INTERFACE_MAPPING (Product Classification)
INSERT INTO webserve.CSTM_PRODUCT_INTERFACE_MAPPING (PRODUCT_CODE, PRODUCT_GROUP) VALUES ('RTFT', 'INTERBANK');
INSERT INTO webserve.CSTM_PRODUCT_INTERFACE_MAPPING (PRODUCT_CODE, PRODUCT_GROUP) VALUES ('RTNP', 'INTERBANK');
INSERT INTO webserve.CSTM_PRODUCT_INTERFACE_MAPPING (PRODUCT_CODE, PRODUCT_GROUP) VALUES ('RTIN', 'INTERBANK');
INSERT INTO webserve.CSTM_PRODUCT_INTERFACE_MAPPING (PRODUCT_CODE, PRODUCT_GROUP) VALUES ('RTIB', 'INTRABANK');
INSERT INTO webserve.CSTM_PRODUCT_INTERFACE_MAPPING (PRODUCT_CODE, PRODUCT_GROUP) VALUES ('RTAT', 'INTRABANK');
INSERT INTO webserve.CSTM_PRODUCT_INTERFACE_MAPPING (PRODUCT_CODE, PRODUCT_GROUP) VALUES ('RTMO', 'INTRABANK');
INSERT INTO webserve.CSTM_PRODUCT_INTERFACE_MAPPING (PRODUCT_CODE, PRODUCT_GROUP) VALUES ('RTUS', 'INTRABANK');


-- STZM_CUSTOMER + STZM_CUST_ACCOUNT (5,000 Customers & Accounts)
-- Accounts distributed round-robin across branches 001/002/003
-- Account format: <branch>+LPAD(i,7,'0')  e.g. 0010000001, 0020000002, 0030000003
-- Customer IDs: 100001 through 105000
-- First 1,000 accounts (seq 1-1000) are included in the Debezium filter
DECLARE
    TYPE t_names IS TABLE OF VARCHAR2(30) INDEX BY PLS_INTEGER;
    v_first  t_names;
    v_last   t_names;
    v_branch VARCHAR2(3);
    v_acct   VARCHAR2(10);
    v_cust   VARCHAR2(6);
    v_fname  VARCHAR2(30);
    v_lname  VARCHAR2(30);
    v_full   VARCHAR2(60);
    v_bal    NUMBER;
    v_open   DATE;
BEGIN
    -- 50 Nigerian first names
    v_first(1):='Adebayo';    v_first(2):='Chioma';     v_first(3):='Emeka';      v_first(4):='Funke';      v_first(5):='Ibrahim';
    v_first(6):='Ngozi';      v_first(7):='Tunde';      v_first(8):='Amina';      v_first(9):='Olumide';    v_first(10):='Blessing';
    v_first(11):='Chinedu';   v_first(12):='Fatima';    v_first(13):='Yusuf';     v_first(14):='Temitope';  v_first(15):='Grace';
    v_first(16):='Musa';      v_first(17):='Damilola';  v_first(18):='Hauwa';     v_first(19):='Oluwaseun'; v_first(20):='Amaka';
    v_first(21):='Segun';     v_first(22):='Kemi';      v_first(23):='Obinna';    v_first(24):='Aisha';     v_first(25):='Folake';
    v_first(26):='Samuel';    v_first(27):='Zainab';    v_first(28):='Chinwe';    v_first(29):='Hassan';    v_first(30):='Bukola';
    v_first(31):='Taiwo';     v_first(32):='Kehinde';   v_first(33):='Nneka';     v_first(34):='Ahmed';     v_first(35):='Bola';
    v_first(36):='Ifeanyi';   v_first(37):='Halima';    v_first(38):='Tobi';      v_first(39):='Jumoke';    v_first(40):='Abdullahi';
    v_first(41):='Chidi';     v_first(42):='Laide';     v_first(43):='Ugochukwu'; v_first(44):='Rashida';   v_first(45):='Adaobi';
    v_first(46):='Femi';      v_first(47):='Hajara';    v_first(48):='Nnamdi';    v_first(49):='Sadiya';    v_first(50):='Ogechi';

    -- 100 Nigerian last names
    v_last(1):='Ogunlesi';    v_last(2):='Nwosu';       v_last(3):='Obiora';      v_last(4):='Akindele';    v_last(5):='Musa';
    v_last(6):='Okafor';      v_last(7):='Bakare';      v_last(8):='Adeyemi';     v_last(9):='Eze';         v_last(10):='Okoro';
    v_last(11):='Abdullahi';  v_last(12):='Balogun';    v_last(13):='Mohammed';   v_last(14):='Adesanya';   v_last(15):='Obi';
    v_last(16):='Adekunle';   v_last(17):='Ibrahim';    v_last(18):='Onyeka';     v_last(19):='Garba';      v_last(20):='Okonkwo';
    v_last(21):='Abubakar';   v_last(22):='Oluwole';    v_last(23):='Chukwu';     v_last(24):='Nwachukwu';  v_last(25):='Adamu';
    v_last(26):='Oladipo';    v_last(27):='Aliyu';      v_last(28):='Osagie';     v_last(29):='Umeh';       v_last(30):='Bello';
    v_last(31):='Nwankwo';    v_last(32):='Afolabi';    v_last(33):='Idris';      v_last(34):='Ugwu';       v_last(35):='Suleiman';
    v_last(36):='Ogundele';   v_last(37):='Usman';      v_last(38):='Chukwuma';   v_last(39):='Adeleke';    v_last(40):='Sani';
    v_last(41):='Okeke';      v_last(42):='Olanrewaju'; v_last(43):='Lawal';      v_last(44):='Nwafor';     v_last(45):='Adegoke';
    v_last(46):='Haruna';     v_last(47):='Nwokoye';    v_last(48):='Olatunji';   v_last(49):='Oyelaran';   v_last(50):='Ogbonna';
    v_last(51):='Adeniyi';    v_last(52):='Amadi';      v_last(53):='Danjuma';    v_last(54):='Ekwueme';    v_last(55):='Fashola';
    v_last(56):='Gana';       v_last(57):='Iheanacho';  v_last(58):='Jimoh';      v_last(59):='Kalu';       v_last(60):='Lateef';
    v_last(61):='Maduka';     v_last(62):='Ndukwe';     v_last(63):='Obasi';      v_last(64):='Peterside';  v_last(65):='Rabiu';
    v_last(66):='Salami';     v_last(67):='Udoh';       v_last(68):='Waziri';     v_last(69):='Yakubu';     v_last(70):='Asogwa';
    v_last(71):='Babatunde';  v_last(72):='Dikko';      v_last(73):='Effiong';    v_last(74):='Falana';     v_last(75):='Gowon';
    v_last(76):='Ibekwe';     v_last(77):='Jibrin';     v_last(78):='Kolawole';   v_last(79):='Lamidi';     v_last(80):='Mbah';
    v_last(81):='Ndigwe';     v_last(82):='Obaseki';    v_last(83):='Quadri';     v_last(84):='Raji';       v_last(85):='Shagari';
    v_last(86):='Teniola';    v_last(87):='Uzoma';      v_last(88):='Wasiu';      v_last(89):='Yinka';      v_last(90):='Ajayi';
    v_last(91):='Bamidele';   v_last(92):='Dike';       v_last(93):='Ezeigbo';    v_last(94):='Fowowe';     v_last(95):='Gwani';
    v_last(96):='Ibe';        v_last(97):='Jalingo';    v_last(98):='Kayode';     v_last(99):='Oduya';      v_last(100):='Zubair';

    FOR i IN 1..5000 LOOP
        -- Round-robin branch assignment
        v_branch := CASE MOD(i - 1, 3) WHEN 0 THEN '001' WHEN 1 THEN '002' ELSE '003' END;
        v_acct   := v_branch || LPAD(i, 7, '0');
        v_cust   := TO_CHAR(100000 + i);
        v_fname  := v_first(MOD(i - 1, 50) + 1);
        v_lname  := v_last(TRUNC((i - 1) / 50) + 1);
        v_full   := v_fname || ' ' || v_lname;
        v_bal    := TRUNC(DBMS_RANDOM.VALUE(50000, 10000000));
        v_open   := DATE '2019-01-01' + TRUNC(DBMS_RANDOM.VALUE(0, 1800));  -- random date 2019-2023

        INSERT INTO abfcubslive.STZM_CUSTOMER (
            CUSTOMER_NO, CUSTOMER_TYPE, CUSTOMER_NAME1, SHORT_NAME, FULL_NAME,
            NATIONALITY, COUNTRY, LOCAL_BRANCH, FROZEN, DECEASED,
            RECORD_STAT, AUTH_STAT, CIF_CREATION_DATE
        ) VALUES (
            v_cust, 'I', v_full, UPPER(SUBSTR(v_lname, 1, 8)), v_full,
            'NG', 'NG', v_branch, 'N', 'N',
            'O', 'A', v_open
        );

        INSERT INTO abfcubslive.STZM_CUST_ACCOUNT (
            BRANCH_CODE, CUST_AC_NO, AC_DESC, CUST_NO, CCY,
            ACCOUNT_CLASS, RECORD_STAT, AUTH_STAT, AC_OPEN_DATE, ACY_CURR_BALANCE
        ) VALUES (
            v_branch, v_acct, v_full || ' Savings', v_cust, 'NGN',
            '010003', 'O', 'A', v_open, v_bal
        );

        IF MOD(i, 500) = 0 THEN
            COMMIT;
            DBMS_OUTPUT.PUT_LINE('  Seeded ' || i || ' / 5000 customers & accounts');
        END IF;
    END LOOP;
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Done. Seeded 5,000 customers and accounts.');
END;
/

