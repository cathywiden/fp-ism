// server/utilities/checkDocumentTampering.js

const { getConnection } = require("./dbConnector");
const logger = require("./logger");
require("dotenv").config({ path: "../.env" });

async function checkDocumentTampering(documentId) {
  let connection;
  try {
    connection = await getConnection("user2");
    const query = `
      SELECT TAMPERED_HASH 
      FROM ${process.env.DB_TABLE_CHECKSUM} 
      WHERE DOC_ID = :documentId AND TAMPERED_HASH IS NOT NULL`;

    const result = await connection.execute(query, [documentId]);

    // if TAMPERED_HASH is not null, the document has been tampered with
    return result.rows.length > 0;
  } catch (error) {
    logger.error(`Error in checkDocumentTampering: ${error.message}`);
    return false; // in case of an error, treat as not tampered for safety -- "not guilty until evidence"
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = checkDocumentTampering;
