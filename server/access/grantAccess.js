// server/access/grantAccess.js

require("dotenv").config({ path: "../.env" });

const { getConnection } = require("../utilities/dbConnector");

const logger = require("../utilities/logger");

const { getUserWalletAddress } = require("../utilities/extractWalletAddress");

const { mintAccessToken } = require("../utilities/smartContractUtils");

const { executeBlockchainMockChecksum } = require("../utilities/dbUtils");

// is the document already shared?
async function checkExistingShare(connection, documentId, targetUser) {
  const sharedDocsCheck = await connection.execute(
    `SELECT COUNT(*) AS count FROM ${process.env.DB_USER2}.${process.env.DB_TABLE_SHARED_DOCS} WHERE DOCUMENT_ID = :documentId AND TARGET_USER = :targetUser`,
    [documentId, targetUser]
  );
  if (sharedDocsCheck.rows[0].COUNT > 0) {
    logger.info(`Document ${documentId} already shared with ${targetUser}`);
    return;
  }
}

// log details in unified table
async function logAccessInDB(
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

// duplicate check
async function checkForExistingRequest(connection, documentId, targetUser) {
  const requestCheckQuery = `
  SELECT COUNT(*) AS count FROM ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} 
      WHERE DOC_ID = :documentId AND TARGET_USER = :targetUser AND STATUS = 'requested'
  `;

  const result = await connection.execute(requestCheckQuery, {
    documentId: documentId,
    targetUser: targetUser,
  });

  // raw result
  logger.debug("Raw Result: " + JSON.stringify(result));

  if (result.rows.length > 0) {
    const row = result.rows[0];

    logger.debug(JSON.stringify(row));
    const REQ_TS = result.rows[0].REQ_TS;
    const REQ_TX_HASH = result.rows[0].REQ_TX_HASH;

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

async function grantAccess(
  documentId,
  targetUser,
  documentHash,
  expiryInSeconds
) {
  let connection;
  try {
    connection = await getConnection("user1");

    if (await checkExistingShare(connection, documentId, targetUser)) {
      return;
    }

    const requestInfo = await checkForExistingRequest(
      connection,
      documentId,
      targetUser
    );

    logger.debug(`requestInfo in grantAccess: ${JSON.stringify(requestInfo)}`);

    const userWalletAddress = await getUserWalletAddress(targetUser);
    const documentHash = await executeBlockchainMockChecksum(documentId);

    const { transactionHash, tokenId } = await mintAccessToken(
      userWalletAddress,
      documentId,
      documentHash,
      expiryInSeconds
    );

    if (!transactionHash || tokenId === null || tokenId === undefined) {
      logger.error(
        "Token minting failed. No transaction hash or token ID received."
      );
      return;
    }

    // check if the request already exists and is in 'requested' status
    if (requestInfo) {
      // update the existing request
      await updateExistingRequest(
        connection,
        documentId,
        targetUser,
        tokenId,
        transactionHash,
        expiryInSeconds,
        requestInfo
      );
    } else {
      // log in database
      await logAccessInDB(
        connection,
        documentId,
        tokenId,
        targetUser,
        transactionHash,
        expiryInSeconds
      );
    }

    logger.info(
      `Document ${documentId} shared with ${targetUser}. Token id: ${tokenId}, Transaction hash: ${transactionHash}`
    );
  } catch (error) {
    logger.error(`Error in granting access: ${error.message}`);
    if (error.sqlMessage) {
      logger.error(`SQL Error: ${error.sqlMessage}`);
    }
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { grantAccess };
