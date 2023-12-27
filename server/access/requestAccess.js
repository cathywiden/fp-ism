// server/access/requestAccess.js

require("dotenv").config();
const logger = require("../utilities/logger");
const { getConnection } = require("../utilities/dbConnector");

async function requestDocumentAccess(documentId, requester) {
  let connection;
  try {
    connection = await getConnection("user1");

    //  querying heap table in steps:

    // 1. get heap ID from T_DOCSTORE
    const heapIdQuery = `SELECT HEAP_ID FROM T_DOCSTORE WHERE DOC_ID = :documentId`;
    const heapIdResult = await connection.execute(heapIdQuery, [documentId]);

    // 2. check if the document_id exists in T_DOCSTORE
    if (heapIdResult.rows.length === 0) {
      logger.info("Document not found in T_DOCSTORE");
      return "Document ID not found";
    }

    const heapId = heapIdResult.rows[0].HEAP_ID;

    // 3. construct heap table name
    const heapTableName = `"t_heap_${heapId}"`;

    // 4. does the dicument exist?
    const docCheckQuery = `SELECT COUNT(*) AS count FROM ${heapTableName} WHERE DOCUMENT_ID = :documentId`;

    logger.debug(`Document ID check query: ${docCheckQuery}`);

    const docExistsResult = await connection.execute(docCheckQuery, [
      documentId,
    ]);

    // check for actual document data (not ID)
    if (docExistsResult.rows[0].COUNT === 0) {
      console.log("Document data not found");
      return "Document data not found";
    } else {
      logger.debug(`Sending requestQuery`);

      // check if a request already exists
      const existingRequestCheck = `SELECT COUNT(*) AS count FROM ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARE_ON_REQUEST} WHERE DOCUMENT_ID = :documentId AND TARGET_USER = :requester`;
      const existingRequestResult = await connection.execute(
        existingRequestCheck,
        [documentId, requester]
      );

      if (existingRequestResult.rows[0].COUNT > 0) {
        logger.info(
          `Request already exists for Document ID: ${documentId} by User: ${requester}`
        );
        return "Request already exists";
      }

      const requestQuery = `INSERT INTO ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARE_ON_REQUEST} (DOCUMENT_ID, TARGET_USER, REQUEST_TIME) VALUES (:documentId, :requester, :requestTime)`;

      logger.debug(`Document request logging query: ${requestQuery}`);

      const requestTime = Math.floor(Date.now() / 1000);

      await connection.execute(requestQuery, [
        documentId,
        requester,
        requestTime,
      ]);
      logger.debug(
        `Document ${documentId} has recently been requested by ${requester}`
      );
      return await connection.commit();
    }
  } catch (error) {
    logger.error("Error logging request: " + error.message);
    return "Error logging request";
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { requestDocumentAccess };
