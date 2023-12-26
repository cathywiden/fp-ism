// server/access/tokenUtils.js
require("dotenv").config({ path: "../.env" });
const { getConnection } = require("../utilities/dbConnector");
const logger = require("../utilities/logger");

// get the token ID associated with a given document ID
async function getTokenId(documentId) {
  let connection;
  try {
    connection = await getConnection("user1");
    const query = `SELECT ID FROM ${process.env.DB_USER2}.${process.env.DB_TABLE_SHARED_DOCS} WHERE document_id = :documentId`;
    const result = await connection.execute(query, [documentId]);

    if (result.rows.length > 0) {
      return result.rows[0].ID;
    } else {
      logger.info(`No token found for document ID: ${documentId}`);
      return null;
    }
  } catch (error) {
    logger.error(`Error in getTokenId: ${error.message}`);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = { getTokenId };
