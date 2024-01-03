// server/utilities/dbUtils.js

const logger = require("./logger");
const { getConnection } = require("./dbConnector");
require("dotenv").config({ path: "../.env" });

// query document by document_id 
async function getDocumentById(document_id, userType) {
  let connection;
  try {
    logger.debug(
      `getDocumentById called with document_id: ${document_id}, userType: ${userType}`
    );
    connection = await getConnection(userType);
    const query = `SELECT DBMS_LOB.SUBSTR(XML, 500, 1) AS XML_SNIPPET FROM ${process.env.DB_TABLE_SHARED_DOCS} WHERE document_id = :id`;
    logger.debug(`Executing query: ${query}`);
    const result = await connection.execute(query, [document_id]);

    logger.info("Query result:", result);
    return result.rows.length > 0 ? result.rows[0].XML_SNIPPET : null;
  } catch (error) {
    logger.error(`Error in getDocumentById: ${error.message}`);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

// execute Oracle procedure blockchain_mock_checksum
async function executeBlockchainMockChecksum(documentId) {
  let connection;

  try {
    logger.debug(`Executing blockchain_mock_checksum with documentId: ${documentId}`);
    connection = await getConnection("user1");

    // execute DB procedure
    await connection.execute(
      `BEGIN
         blockchain_mock_checksum(:documentId);
       END;`,
      { documentId: documentId },
      { autoCommit: true }
    );

    // fetch checksum for documentId
    const result = await connection.execute(
      `SELECT CHECKSUM FROM BCCONV.BLOCKCHAIN_CHECKSUM WHERE DOC_ID = :documentId`,
      [documentId]
    );

    if (result.rows.length > 0) {
      const checksum = result.rows[0].CHECKSUM;
      logger.info(`Retrieved checksum: ${checksum}`);
      return checksum;
    } else {
      logger.error(`No checksum found for document ID: ${documentId}`);
      return null;
    }
  } catch (error) {
    logger.error(`Error in executeBlockchainMockChecksum: ${error.message}`);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

// clean up expired tokens
async function getExpiredTokens() {
  let connection;
  try {
    connection = await getConnection("user1");
    const result = await connection.execute(
      `SELECT token_id FROM ${process.env.DB_TABLE_SHARED_DOCS} WHERE token_expiry < SYSTIMESTAMP`
    );
    return result.rows.map(row => row.token_id);
  } catch (error) {
    console.error(`Error fetching expired tokens: ${error.message}`);
    return [];
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { getDocumentById, getExpiredTokens, executeBlockchainMockChecksum };
