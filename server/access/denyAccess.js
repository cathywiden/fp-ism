// server/access/denyAccess.js
require("dotenv").config();

const { getConnection } = require("../utilities/dbConnector");
const logger = require("../utilities/logger");

async function denyDocumentAccess(documentId, reason) {
  let connection;
  try {
    connection = await getConnection("user1");
    const denyTime = Math.floor(Date.now() / 1000);
    const denyQuery = `INSERT INTO ${process.env.DB_USER1}.${process.env.DB_TABLE_DENIED}
                      (DOCUMENT_ID, DENY_TIME, DENY_REASON)  
                      VALUES 
                      (:documentId, :denyTime, :reason)`;
    await connection.execute(denyQuery, {
      documentId,
      denyTime,
      reason,
    });
    await connection.commit();
    logger.info(`Access denial logged for document ${documentId}`);
  } catch (error) {
    logger.error(`Error logging deny access: ${error.message}`);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = { denyDocumentAccess };
