// server/utilities/dbUtils.js

const logger = require("./logger");
const { getConnection } = require("./dbConnector");
const { connectToHeap } = require("../utilities/heapConnect");
require("dotenv").config({ path: "../.env" });

// query document by document_id
async function getDocumentById(document_id, userType) {
  let connection;
  try {
    logger.debug(
      `getDocumentById called with document_id: ${document_id}, userType: ${userType}`
    );
    connection = await getConnection(userType);
    const query = `SELECT DBMS_LOB.SUBSTR(XML, 500, 1) AS XML_SNIPPET FROM ${process.env.DB_TABLE_SHARED_DOCS} WHERE doc_id = :id`;
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
    logger.debug(
      `Executing blockchain_mock_checksum with documentId: ${documentId}`
    );
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

async function checkIfAlreadyShared(connection, documentId, targetUser) {
  const sharedDocsCheck = await connection.execute(
    `SELECT COUNT(*) AS count FROM ${process.env.DB_USER2}.${process.env.DB_TABLE_SHARED_DOCS} WHERE DOC_ID = :documentId AND TARGET_USER = :targetUser`,
    [documentId, targetUser]
  );
  if (sharedDocsCheck.rows[0].COUNT > 0) {
    logger.info(`Document ${documentId} already shared with ${targetUser}`);
    return;
  }
}

async function doesRequestExist(connection, documentId, requester) {
  const heapDetails = await connectToHeap(documentId);
  const docCheckQuery = heapDetails.docCheckQuery;

  logger.debug(`docCheckQuery: ${docCheckQuery}`);

  // execute document existance check
  const docExistsResult = await connection.execute(docCheckQuery, [documentId]);

  // check if document exists in heap
  // check for actual document data (not ID)
  if (docExistsResult.rows[0].COUNT === 0) {
    console.log("Document data not found");
    return "Document data not found";
  } else {
    // check if a request already exists
    const existingRequestCheck = `SELECT COUNT(*) AS count FROM ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} WHERE DOC_ID = :documentId AND TARGET_USER = :requester AND STATUS = 'requested'`;
    const existingRequestResult = await connection.execute(
      existingRequestCheck,
      {
        documentId: documentId,
        requester: requester,
      }
    );

    if (existingRequestResult.rows[0].COUNT > 0) {
      logger.info(
        `Request already exists for Document ID: ${documentId} by User: ${requester}`
      );
      return "Request already exists";
    }
  }

  return "No duplicates";
}

async function checkForExistingRequest(connection, documentId, targetUser) {
  const requestCheckQuery = `
    SELECT REQ_TS, REQ_TX_HASH 
    FROM ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} 
    WHERE DOC_ID = :documentId AND TARGET_USER = :targetUser AND STATUS = 'requested'
  `;

  try {
    const result = await connection.execute(requestCheckQuery, {
      documentId: documentId,
      targetUser: targetUser,
    });

    logger.debug("Raw Result: " + JSON.stringify(result));

    if (result.rows.length > 0) {
      const { REQ_TS, REQ_TX_HASH } = result.rows[0];
      logger.debug(
        `Found Request - Timestamp: ${REQ_TS}, TxHash: ${REQ_TX_HASH}`
      );
      return {
        requestTimestamp: REQ_TS,
        requestTxHash: REQ_TX_HASH,
      };
    } else {
      logger.debug(
        `No existing request found for documentId=${documentId}, targetUser=${targetUser}`
      );
      return null;
    }
  } catch (error) {
    logger.error(`Error in checkForExistingRequest: ${error.message}`);
    return null;
  }
}

async function updateExistingRequestForDeny(
  connection,
  documentId,
  targetUser,
  reason,
  transactionHash,
  requestInfo
) {
  logger.debug(
    `Before executing UPDATE: DOC_ID = ${documentId}, TARGET_USER = ${targetUser}`
  );

  const denyTime = Math.floor(Date.now() / 1000);
  const denyQuery = `UPDATE ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS}  
  SET DENY_TS = :denyTime, TARGET_USER = :targetUser, DENY_TX_HASH = :transactionHash, STATUS = 'denied', REASON = :reason
  WHERE DOC_ID = :documentId AND STATUS = 'requested'`;

  logger.debug(`Am I here in dbUtils?`);

  try {
    const result = await connection.execute(denyQuery, {
      documentId: documentId,
      targetUser: targetUser,
      transactionHash: transactionHash,
      denyTime: denyTime,
      reason: reason
    });

    logger.debug(`UPDATE Query executed. Rows updated: ${result.rowsAffected}`);
    await connection.commit();
  } catch (error) {
    logger.error(`Error in updateExistingRequestForDeny: ${error.message}`);
  }
}



// if a request already exists, update the SAME row with grant details
async function updateExistingRequest(
  connection,
  documentId,
  targetUser,
  tokenId,
  transactionHash,
  expiryInSeconds,
  requestInfo
) {
  logger.debug(
    `Before executing UPDATE: DOC_ID = ${documentId}, TARGET_USER = ${targetUser}`
  );

  const shareTime = Math.floor(Date.now() / 1000);
  const tokenExpiry = shareTime + expiryInSeconds;
  const updateQuery = `UPDATE ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS}  
  SET TOKEN_ID = :tokenId, GRANT_TS = :shareTime, TOKEN_EXP_TS = :tokenExpiry, GRANT_TX_HASH = :transactionHash, STATUS = 'granted'
  WHERE DOC_ID = :documentId AND STATUS = 'requested'`;

  const result = await connection.execute(updateQuery, {
    documentId: documentId,
    tokenId: tokenId,
    shareTime: shareTime,
    tokenExpiry: tokenExpiry,
    transactionHash: transactionHash,
  });

  logger.debug(`UPDATE Query executed. Rows updated: ${result.rowsAffected}`);

  await connection.commit();
}

async function logRequestDB(
  connection,
  documentId,
  requester,
  requestTime,
  transactionHash
) {
  try {
    const requestQuery = `INSERT INTO ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} (DOC_ID, TARGET_USER, REQ_TS, REQ_TX_HASH, STATUS) VALUES (:documentId, :requester, :requestTime, :transactionHash, 'requested')`;

    logger.debug(`Document request logging query: ${requestQuery}`);

    await connection.execute(requestQuery, [
      documentId,
      requester,
      requestTime,
      transactionHash,
    ]);
    logger.debug(
      `Document ${documentId} has recently been requested by ${requester}`
    );

    return await connection.commit();
  } catch (error) {
    logger.error("Error logging request: " + error.message);
    return "Error logging request";
  }
}

// log details in unified table
async function logGrantInDB(
  connection,
  documentId,
  tokenId,
  targetUser,
  transactionHash,
  expiryInSeconds,
  requestInfo
) {
  const shareTime = Math.floor(Date.now() / 1000);
  const tokenExpiry = shareTime + expiryInSeconds;

  const accessQuery = `INSERT INTO ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} 
  (DOC_ID, TOKEN_ID, TARGET_USER, REQ_TS, GRANT_TS, TOKEN_EXP_TS, GRANT_TX_HASH, STATUS) 
  VALUES (:documentId, :tokenId, :targetUser, :requestTimestamp, :shareTime, :tokenExpiry, :transactionHash, 'granted')`;

  await connection.execute(accessQuery, {
    documentId: documentId,
    tokenId: tokenId,
    targetUser: targetUser,
    requestTimestamp: requestInfo ? requestInfo.requestTimestamp : null,
    shareTime: shareTime,
    tokenExpiry: tokenExpiry,
    transactionHash: transactionHash,
  });
  await connection.commit();
}

async function logDenyInDB(documentId, targetUser, reason, transactionHash, requestInfo) {
  let connection;
  try {
    connection = await getConnection("user1");

    const denyQuery = `INSERT INTO ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} 
                        (DOC_ID, TARGET_USER, DENY_TS, REASON, DENY_TX_HASH) 
                       VALUES (:documentId, :targetUser, :denyTime, :denyReason, :transactionHash)`;



    const result = await connection.execute(denyQuery, {
      documentId: documentId,
      targetUser: targetUser,
      denyTime: Math.floor(Date.now() / 1000),
      denyReason: reason,
      transactionHash: transactionHash,
      requestTimestamp: requestInfo ? requestInfo.requestTimestamp : null,
    });

    logger.debug("Raw Result: " + JSON.stringify(result));

    await connection.commit();

    return result;

  } catch (error) {
    logger.error(`Error in granting access: ${error.message}`);
    if (error.sqlMessage) {
      logger.error(`SQL Error: ${error.sqlMessage}`);
    }
  } finally {
    if (connection) await connection.close();
  }
}

// clean up expired tokens in db
async function getExpiredTokens() {
  let connection;
  try {
    connection = await getConnection("user1");
    const result = await connection.execute(
      `SELECT token_id FROM ${process.env.DB_TABLE_SHARED_DOCS} WHERE token_expiry < SYSTIMESTAMP`
    );
    return result.rows.map((row) => row.token_id);
  } catch (error) {
    console.error(`Error fetching expired tokens: ${error.message}`);
    return [];
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = {
  getDocumentById,
  getExpiredTokens,
  executeBlockchainMockChecksum,
  checkIfAlreadyShared,
  checkForExistingRequest,
  doesRequestExist,
  updateExistingRequest,
  logGrantInDB,
  logRequestDB,
  logDenyInDB,
  updateExistingRequestForDeny,
  
};
