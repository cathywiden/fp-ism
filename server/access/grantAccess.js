// server/access/grantAccess.js

require("dotenv").config({ path: "../.env" });

const { getConnection } = require("../utilities/dbConnector");

const logger = require("../utilities/logger");

const { getUserWalletAddress } = require("../utilities/extractWalletAddress");

const { mintAccessToken } = require("../utilities/smartContractUtils");

async function grantAccess(documentId, targetUser, isProactive = false) {
  let connection;
  try {
    connection = await getConnection("user1");
    const tableName = isProactive
      ? process.env.DB_TABLE_SHARE_PROACTIVE
      : process.env.DB_TABLE_SHARE_ON_REQUEST;

    // check for existing share
    const sharedDocsCheck = await connection.execute(
      `SELECT COUNT(*) AS count FROM ${process.env.DB_USER2}.${process.env.DB_TABLE_SHARED_DOCS} WHERE DOCUMENT_ID = :documentId AND TARGET_USER = :targetUser`,
      [documentId, targetUser]
    );
    if (sharedDocsCheck.rows[0].COUNT > 0) {
      logger.info(`Document ${documentId} already shared with ${targetUser}`);
      return;
    }

    // mint token
    const userWalletAddress = await getUserWalletAddress(targetUser);
    const metadataURI = `doc:${documentId}`;
    const transactionHash = await mintAccessToken(
      userWalletAddress,
      documentId,
      metadataURI
    );
    if (!transactionHash) {
      logger.error("Token minting failed. No transaction hash received.");
      return;
    }

    // get current unix timestamps
    const shareTime = Math.floor(Date.now() / 1000);
    const tokenExpiry = shareTime + 604800; // 1 week in seconds

    // insert into both the sharer's and the receiver's tables
    await connection.execute(
      `INSERT INTO ${tableName} (DOCUMENT_ID, TARGET_USER, SHARE_TIME, ACCESS_TRANSACTION_HASH, TOKEN_EXPIRY) VALUES (:documentId, :targetUser, :shareTime, :transactionHash, :tokenExpiry)`,
      [documentId, targetUser, shareTime, transactionHash, tokenExpiry]
    );
    await connection.commit();
    logger.info(
      `Document ${documentId} shared with ${targetUser} and token minted successfully`
    );
  } catch (error) {
    logger.error(`Error in granting access: ${error.message}`);
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { grantAccess };
