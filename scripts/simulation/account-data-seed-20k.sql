-- Seed additional 15,000 accounts (seq 5001–20000) to bring total to 20,000
-- Run AFTER account-data-simulation.sql (which creates seq 1–5000)
-- Customer IDs: 105001 through 120000
-- Account format: <branch>+LPAD(i,7,'0')  e.g. 0010005001, 0020005002
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

    FOR i IN 5001..20000 LOOP
        v_branch := CASE MOD(i - 1, 3) WHEN 0 THEN '001' WHEN 1 THEN '002' ELSE '003' END;
        v_acct   := v_branch || LPAD(i, 7, '0');
        v_cust   := TO_CHAR(100000 + i);
        v_fname  := v_first(MOD(i - 1, 50) + 1);
        v_lname  := v_last(MOD(TRUNC((i - 1) / 50), 100) + 1);
        v_full   := v_fname || ' ' || v_lname;
        v_bal    := TRUNC(DBMS_RANDOM.VALUE(50000, 10000000));
        v_open   := DATE '2019-01-01' + TRUNC(DBMS_RANDOM.VALUE(0, 1800));

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

        IF MOD(i, 1000) = 0 THEN
            COMMIT;
            DBMS_OUTPUT.PUT_LINE('  Seeded ' || i || ' / 20000 customers & accounts');
        END IF;
    END LOOP;
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Done. Seeded additional 15,000 accounts (5001-20000). Total: 20,000.');
END;
/
