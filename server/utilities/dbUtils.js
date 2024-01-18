const logger = require("./logger");
const { getConnection } = require("./dbConnector");
const { connectToHeap } = require("./heapConnect");
require("dotenv").config({ path: "../.env" });

const EXPIRE_DOCUMENTS_INTERVAL = 300000; // run batch job in DB every 5 min

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

// query all available shared documents for user1 and user2
async function getAllSharedDocs(userType) {
  let connection;
  logger.debug(`getAllSharedDocs called for userType: ${userType}`);

  try {
    connection = await getConnection(userType);
    let query;

    if (userType === "user1") {
      // get the latest entry for each DOC_ID
      // I log each full grant/revoke cycle in the DB on a new row
      // meaning, if I grant/revoke and then grant again, it will start a new row
      // on frontend, enough to display the last (actual) state of the document, because historical data are directly available to user1 via the DB
      query = `
      SELECT a.DOC_ID, a.TARGET_USER, a.STATUS, a.TOKEN_ID, a.TOKEN_EXP_TS
FROM ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} a
LEFT JOIN (
    SELECT DOC_ID, MAX(TOKEN_ID) as MAX_TOKEN_ID
    FROM ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS}
    GROUP BY DOC_ID
) b ON a.DOC_ID = b.DOC_ID
WHERE a.STATUS IN ('requested', 'denied') OR a.TOKEN_ID = b.MAX_TOKEN_ID
ORDER BY a.DOC_ID, a.TOKEN_ID DESC
    `;
    } else if (userType === "user2") {
      query = `SELECT DOC_ID, TOKEN_EXP_TS FROM ${process.env.DB_USER2}.${process.env.DB_TABLE_SHARED_DOCS}`;
    } else {
      throw new Error("Invalid user type");
    }

    // logger.debug(`Executing query: ${query}`);
    const result = await connection.execute(query);
    return result.rows;
  } catch (error) {
    logger.error(`Error in getAllSharedDocs: ${error.message}`);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

// purge expired docs from DB
// call Oracle procedure
async function expireDocuments() {
  let connection;
  try {
    connection = await getConnection("user1");

    // procedure set in Oracle will set status to "expired" based on timestamps
    await connection.execute(`BEGIN blockchain_expire_documents; END;`);
    await connection.commit();
  } catch (err) {
    console.error("Error executing expireDocuments procedure:", err);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
}

// execute Oracle procedure blockchain_mock_checksum
// the procedure itself in Oracle will:
// -- fetch the XML from the "heap" table
// -- insert XML into {process.env.DB_USER2}{process.env.DB_TABLE_CHECKSUM}
// -- calculate a moch checksum by hashing the first 500 chars of the XML
// -- insert the mock checksum into the same table
// used for: both logging the checksum together with the document when mintign a token, but also for tampering detection (if the checksum changes).
async function executeBlockchainMockChecksum(documentId) {
  let connection;

  try {
    logger.debug(
      `Executing blockchain_mock_checksum with documentId: ${documentId}`
    );
    connection = await getConnection("user1");

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
  logger.debug(
    `Executing checkIfAlreadyShared for Document ID: ${documentId}, Target User: ${targetUser}`
  );

  const sharedDocsCheck = await connection.execute(
    `SELECT COUNT(*) AS count FROM ${process.env.DB_USER2}.${process.env.DB_TABLE_SHARED_DOCS} WHERE DOC_ID = :documentId AND TARGET_USER = :targetUser`,
    [documentId, targetUser]
  );

  logger.debug(
    `Query executed. Result: ${JSON.stringify(sharedDocsCheck.rows)}`
  );

  if (sharedDocsCheck.rows.length > 0 && sharedDocsCheck.rows[0].COUNT > 0) {
    logger.info(
      `Document ${documentId} already shared with ${targetUser}. Found ${sharedDocsCheck.rows[0].COUNT} shares.`
    );
    return true; // doc already shared
  }

  logger.debug(
    `Document ${documentId} not shared with ${targetUser} yet. Proceeding with sharing.`
  );
  return false; // doc not shared
}

// check if a share request already exists for the same documentId and requester
// it also checks if the document exists and if access has already been granted
async function doesRequestExist(connection, documentId, requester) {
  const heapDetails = await connectToHeap(documentId);
  const docCheckQuery = heapDetails.docCheckQuery;
  logger.debug(`docCheckQuery: ${docCheckQuery}`);

  const docExistsResult = await connection.execute(docCheckQuery, [documentId]);

  // check if document exists in heap (check for actual document data, not ID)
  if (docExistsResult.rows[0].COUNT === 0) {
    return "Document data not found";
  } else {
    // check if a request or grant already exists
    // select the newest entry in case there had been a DB timeout earlier,
    // so some entry may have gotten "stuck" in pending status,
    // but then there had been some action on top that did get logged
    // IF there is a truly pending status, it will be the newest entry
    // all else is previous DB errors
    const existingCheck = `
  SELECT STATUS 
  FROM ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} 
  WHERE DOC_ID = :documentId AND TARGET_USER = :requester
  ORDER BY REQ_TS DESC
  FETCH FIRST ROW ONLY
`;
    const existingResult = await connection.execute(existingCheck, {
      documentId: documentId,
      requester: requester,
    });

    logger.debug(`Incoming request check result: ${existingResult.rows[0]}`);

    if (existingResult.rows.length > 0) {
      const status = existingResult.rows[0].STATUS;
      if (status === "requested") {
        logger.info(
          `Request already exists for Document ID: ${documentId} by User: ${requester}`
        );
        return "Request already exists";
      } else if (status === "granted") {
        logger.info(
          `Access already granted for Document ID: ${documentId} to User: ${requester}`
        );
        return "Access already granted";
      }
    }
  }

  return "No duplicates";
}

// check specifically for an existing "requested" status for a given document and target user
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

async function logAction(connection, actionType, details) {
  const currentTime = Math.floor(Date.now() / 1000);
  let query;
  let queryParams;

  switch (actionType) {
    case "request":
      query = `INSERT INTO ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} (DOC_ID, TARGET_USER, REQ_TS, REQ_TX_HASH, STATUS) VALUES (:documentId, :requester, :requestTime, :transactionHash, 'requested')`;
      queryParams = [
        details.documentId,
        details.requester,
        details.requestTime,
        details.transactionHash,
      ];
      break;

    case "grant":
      const shareTime = Math.floor(Date.now() / 1000);
      const tokenExpiry = shareTime + details.expiryInSeconds;
      query = `INSERT INTO ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} (DOC_ID, TOKEN_ID, TARGET_USER, REQ_TS, GRANT_TS, TOKEN_EXP_TS, GRANT_TX_HASH, STATUS) VALUES (:documentId, :tokenId, :targetUser, :requestTimestamp, :shareTime, :tokenExpiry, :transactionHash, 'granted')`;
      queryParams = {
        documentId: details.documentId,
        tokenId: details.tokenId,
        targetUser: details.targetUser,
        requestTimestamp: details.requestTimestamp,
        shareTime: shareTime,
        tokenExpiry: tokenExpiry,
        transactionHash: details.transactionHash,
      };
      break;

    case "update-grant":
      const updateTokenExpiry = currentTime + details.expiryInSeconds;
      query = `UPDATE ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS}  
                 SET TOKEN_ID = :tokenId, GRANT_TS = :currentTime, TOKEN_EXP_TS = :updateTokenExpiry, GRANT_TX_HASH = :transactionHash, STATUS = 'granted'
                 WHERE DOC_ID = :documentId AND STATUS = 'requested'`;
      queryParams = {
        documentId: details.documentId,
        tokenId: details.tokenId,
        currentTime: currentTime,
        updateTokenExpiry: updateTokenExpiry,
        transactionHash: details.transactionHash,
      };
      break;

    case "deny":
      const denyTime = Math.floor(Date.now() / 1000);
      query = `UPDATE ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} 
        SET TARGET_USER = :targetUser, 
        DENY_TS = :denyTime, REASON = :denyReason, STATUS = 'denied', DENY_TX_HASH = :transactionHash 
       WHERE DOC_ID = :documentId AND STATUS = 'requested'`;
      queryParams = {
        documentId: details.documentId,
        targetUser: details.targetUser,
        denyTime: denyTime,
        denyReason: details.reason,
        transactionHash: details.transactionHash,
      };
      break;

    case "revoke":
      query = `UPDATE ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} SET REV_TS = :revokeTime, REV_TX_HASH = :transactionHash, REASON = :reason, STATUS = 'revoked' WHERE TOKEN_ID = :tokenId`;
      queryParams = {
        tokenId: details.tokenId,
        revokeTime: currentTime,
        transactionHash: details.transactionHash,
        reason: details.reason,
      };
      break;

    case "renew":
      query = `UPDATE ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} SET 
                  TOKEN_EXP_TS = :tokenExpiry, 
                  RENEW_TS = :renewTime, 
                  RENEW_TX_HASH = :transactionHash, 
                  STATUS = 'granted'
                WHERE TOKEN_ID = :tokenId`;
      queryParams = {
        tokenId: details.tokenId,
        tokenExpiry: details.tokenExpiry,
        transactionHash: details.transactionHash,
        renewTime: currentTime,
      };
      break;

    default:
      logger.error(`Invalid action type: ${actionType}`);
      return;
  }

  try {
    const result = await connection.execute(query, queryParams);
    logger.debug(
      `Action logged in DB. Action type: ${actionType}, Result: ${JSON.stringify(
        result
      )}`
    );
    await connection.commit();
    return result;
  } catch (error) {
    logger.error(`Error in logActionInDB (${actionType}): ${error.message}`);
    if (error.sqlMessage) {
      logger.error(`SQL Error: ${error.sqlMessage}`);
    }
    throw error;
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
  getAllSharedDocs,
  expireDocuments,
  EXPIRE_DOCUMENTS_INTERVAL,
  logAction,
};
