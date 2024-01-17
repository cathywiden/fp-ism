-- upon document sharing, find last version of the document
-- extract XML
-- calculate mock checksum by hashing the first 500 chars
-- insert into checksum log table

CREATE OR REPLACE PROCEDURE CONVTEST.BLOCKCHAIN_MOCK_CHECKSUM (p_document_id IN CHAR)
IS
    l_xml CLOB;
    l_hash VARCHAR2(100);
    l_count NUMBER;
BEGIN
    -- check if an entry already exists for the given document_id
    SELECT COUNT(*) INTO l_count FROM BCCONV.BLOCKCHAIN_CHECKSUM WHERE DOC_ID = p_document_id;

    -- if no entry exists, then proceed
    IF l_count = 0 THEN
        -- retrieve the XML for the highest version of the given document_id
        SELECT XML INTO l_xml FROM (
            SELECT XML FROM CONVTEST."t_heap_eqiPaVxMTHqn$LEWCaD67w" 
            WHERE DOCUMENT_ID = p_document_id 
            ORDER BY VERSION DESC
        ) WHERE ROWNUM = 1;

        -- compute the hash of the first 500 characters of the XML
        l_hash := RAWTOHEX(DBMS_CRYPTO.HASH(UTL_RAW.CAST_TO_RAW(DBMS_LOB.SUBSTR(l_xml, 500, 1)), DBMS_CRYPTO.HASH_SH256));

        -- insert the document_id and hash into the target table
        INSERT INTO BCCONV.BLOCKCHAIN_CHECKSUM (DOC_ID, CHECKSUM) VALUES (p_document_id, l_hash);

        COMMIT;
    END IF;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        -- handle case when document_id is not found
        RAISE_APPLICATION_ERROR(-20001, 'Document ID not found');
    WHEN OTHERS THEN
        -- handle other exceptions
        RAISE;
END;