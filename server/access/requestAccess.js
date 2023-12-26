// server/access/requestAccess.js

require("dotenv").config();
const logger = require("../utilities/logger");
const { getConnection } = require("../utilities/dbConnector");

async function requestDocumentAccess(documentId, requester) {
  let connection;
  try {

    // must pass in user1 here since user2 should have no rights whatsoever to figure out the contents of that table
    connection = await getConnection("user1");
    /*const docCheckQuery = `SELECT COUNT(*) AS count FROM ${process.env.DB_USER1}.${process.env.DB_TABLE_SOURCE} WHERE DOCUMENT_ID = :documentId`;

    logger.debug(`Document ID check query: ${docCheckQuery}`);
    const docExistsResult = await connection.execute(docCheckQuery, [
      documentId,
    ]);
    await connection.commit();

    if (docExistsResult.rows[0].COUNT === 0) {
      return "Document not found";
    }*/

    // need to comment out the document existence check part in order to be able to execute the request query! 
    
    // if I run the check first it will never execute the secodn query. Split into two functions?

    logger.debug(`Sending requestQuery`);


     const requestQuery = `INSERT INTO ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARE_ON_REQUEST} (DOCUMENT_ID, TARGET_USER, REQUEST_TIME) VALUES (:documentId, :requester, :requestTime)`; 
/* const requestQuery = `
  INSERT INTO 
     ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARE_ON_REQUEST}
  (DOCUMENT_ID, TARGET_USER, REQUEST_TIME)  
  VALUES 
   (:documentId, :requester, :requestTime)
 WHERE EXISTS
  (SELECT 1 
   FROM ${process.env.DB_USER1}.${process.env.DB_TABLE_SOURCE}
   WHERE DOCUMENT_ID = :documentId)  
`;
// is the WHERE clause in some way messing with the number of bind values?
 {
  message: 'Error logging request: NJS-098: 4 positional bind values are required but 3 were provided',
  level: 'error',
  service: 'database-service' 
}*/

    logger.debug(`Document request logging query: ${requestQuery}`);

    const requestTime = Math.floor(Date.now() / 1000);
    await connection.execute(requestQuery, [
      documentId,
      requester,
      requestTime,
    ]);
    await connection.commit();
    return "Request logged successfully";
  } catch (error) {
    logger.error("Error logging request: " + error.message);
    return "Error logging request";
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { requestDocumentAccess };
