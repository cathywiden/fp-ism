// server/access/getTokenId.js

require("dotenv").config({ path: "../.env" });
const { getConnection } = require("./dbConnector");
const logger = require("./logger");

// get the token ID associated with a given document ID
// used in revokeAccess
async function getTokenId(documentId) {
  let connection;
  try {
    connection = await getConnection("user1");
    const query = `SELECT TOKEN_ID FROM ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} WHERE doc_id = :documentId`;

    const result = await connection.execute(query, [documentId]);

    if (result.rows.length > 0) {
      return result.rows[0].TOKEN_ID;
    } else {
      logger.error(`No token found for document ID: ${tokenId}`);
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
