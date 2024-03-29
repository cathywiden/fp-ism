-- procedure to be executed from backend reguarly
-- sets all expired documents' status to expired

CREATE OR REPLACE PROCEDURE CONVTEST.blockchain_expire_docs AS
    current_ts NUMBER;
BEGIN
    current_ts := CONVTEST.get_unix_ts();

    FOR rec IN (SELECT DOC_ID FROM CONVTEST.BLOCKCHAIN_SHARED_DOCS WHERE STATUS = 'granted' AND TOKEN_EXP_TS < current_ts)
    LOOP
        UPDATE CONVTEST.BLOCKCHAIN_SHARED_DOCS
        SET STATUS = 'expired'
        WHERE DOC_ID = rec.DOC_ID;

        DELETE FROM BCCONV.BLOCKCHAIN_SHARED_DOCS
        WHERE DOC_ID = rec.DOC_ID;
    END LOOP;
END;