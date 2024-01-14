CREATE OR REPLACE TRIGGER CONVTEST.TRG_POPULATE_BCCONV_BLOCKCHAIN_SHARED_DOCS
AFTER INSERT OR UPDATE OF GRANT_TX_HASH, STATUS ON CONVTEST.BLOCKCHAIN_SHARED_DOCS
FOR EACH ROW
DECLARE
    v_xml CLOB;
BEGIN
    -- check if a new GRANT_TX_HASH has been inserted/updated or STATUS changed to "granted"
    IF (INSERTING AND :new.GRANT_TX_HASH IS NOT NULL) OR
       (UPDATING AND (:new.GRANT_TX_HASH IS NOT NULL AND (:old.GRANT_TX_HASH IS NULL OR :new.GRANT_TX_HASH != :old.GRANT_TX_HASH))) OR
       (:new.STATUS = 'granted' AND (:old.STATUS IS NULL OR :old.STATUS != 'granted')) THEN

        -- retrieve the XML of the LATEST version of the document associated with the DOC_ID from the heap table
        SELECT XML INTO v_xml FROM (
            SELECT XML FROM CONVTEST."t_heap_eqiPaVxMTHqn$LEWCaD67w"
            WHERE DOCUMENT_ID = :new.DOC_ID
            ORDER BY VERSION DESC
        ) WHERE ROWNUM = 1;

        -- push data into BCCONV's BLOCKCHAIN_SHARED_DOCS table
        INSERT INTO BCCONV.BLOCKCHAIN_SHARED_DOCS 
            (DOC_ID, TARGET_USER, TOKEN_ID, GRANT_TS, TOKEN_EXP_TS, XML)
        VALUES 
            (:new.DOC_ID, :new.TARGET_USER, :new.TOKEN_ID, :new.GRANT_TS, :new.TOKEN_EXP_TS, v_xml);
    END IF;
END;