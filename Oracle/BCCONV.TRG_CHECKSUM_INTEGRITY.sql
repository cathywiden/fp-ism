-- TAMPERING CHECK TRIGGER --
-- recalculate checksum automatically upon XML edit
-- log tampered checksum 

CREATE OR REPLACE TRIGGER BCCONV.TRG_CHECKSUM_INTEGRITY
AFTER UPDATE ON BCCONV.BLOCKCHAIN_SHARED_DOCS
FOR EACH ROW
DECLARE
    v_new_checksum RAW(512);
    v_old_checksum RAW(512);
BEGIN
    -- compute the checksum of the new XML
    SELECT RAWTOHEX(DBMS_CRYPTO.HASH(UTL_RAW.CAST_TO_RAW(DBMS_LOB.SUBSTR(:new.XML, 500, 1)), DBMS_CRYPTO.HASH_SH256))
    INTO v_new_checksum
    FROM DUAL;

    -- compute the checksum of the old XML
    SELECT RAWTOHEX(DBMS_CRYPTO.HASH(UTL_RAW.CAST_TO_RAW(DBMS_LOB.SUBSTR(:old.XML, 500, 1)), DBMS_CRYPTO.HASH_SH256))
    INTO v_old_checksum
    FROM DUAL;

    -- check if the checksum has changed
    IF v_new_checksum != v_old_checksum THEN
        -- Update tampering evidence in BLOCKCHAIN_CHECKSUM table
        UPDATE BCCONV.BLOCKCHAIN_CHECKSUM
        SET TAMPERED_HASH = v_new_checksum,
            TAMPER_TS = BCCONV.get_unix_ts()
        WHERE DOC_ID = :new.DOC_ID;
    END IF;
END;