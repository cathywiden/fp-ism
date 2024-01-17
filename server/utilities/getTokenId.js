require("dotenv").config({ path: "../.env" });
const { getConnection } = require("./dbConnector");
const logger = require("./logger");

// get the token ID associated with a given document ID
// used in revokeAccess
async function getTokenId(documentId) {
  let connection;
  try {
    connection = await getConnection("user1");
    // get TOKEN_ID & TARGET_USER from the latest grant
    // there can be multiple grant/revoke cycles as per contract logic
    // I do deliberately allow granting again after a grant/revoke
    const query = `
    SELECT TOKEN_ID, TARGET_USER FROM ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} 
    WHERE doc_id = :documentId 
    ORDER BY GRANT_TS DESC
    FETCH FIRST ROW ONLY
  `;

  const result = await connection.execute(query, [documentId]);

  if (result.rows.length > 0) {

    return { 
      tokenId: result.rows[0].TOKEN_ID, 
      targetUser: result.rows[0].TARGET_USER 
    };
  } else {
      logger.error(`No token found for document ID: ${documentId}`);
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
