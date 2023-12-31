// server/access/grantAccess.js

require("dotenv").config({ path: "../.env" });

const { getConnection } = require("../utilities/dbConnector");

const logger = require("../utilities/logger");

const { getUserWalletAddress } = require("../utilities/extractWalletAddress");

const { mintAccessToken } = require("../utilities/smartContractUtils");

async function grantAccess(
  documentId,
  targetUser,
  documentHash,
  expiryInSeconds,
  isProactive = false
) {
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

    const userWalletAddress = await getUserWalletAddress(targetUser);

    const { transactionHash, tokenId } = await mintAccessToken(
      userWalletAddress,
      documentId,
      documentHash,
      expiryInSeconds
    );

    logger.debug(`GrantAccess.js Received transactionHash: ${transactionHash}`);

    logger.debug(`GrantAccess.js Received tokenId: ${tokenId}`);

    if (!transactionHash || tokenId === null || tokenId === undefined) {
      logger.error(
        "GrantAccess.js Token minting failed. No transaction hash or token ID received."
      );
      return;
    }

    const shareTime = Math.floor(Date.now() / 1000);
    const tokenExpiry = shareTime + expiryInSeconds;

    const accessQuery = `INSERT INTO ${tableName} (DOCUMENT_ID, TOKEN_ID, TARGET_USER, SHARE_TIME, ACCESS_TRANSACTION_HASH, TOKEN_EXPIRY) VALUES (:documentId, :tokenId, :targetUser, :shareTime, :transactionHash, :tokenExpiry)`;

    logger.debug(`GrantAccess.js Query: ${accessQuery}`);

    logger.debug(
      `GrantAccess.js Type of tokenId going into table: ${typeof tokenId} - Value: ${tokenId}`
    );

    await connection.execute(accessQuery, [
      documentId,
      tokenId,
      targetUser,
      shareTime,
      transactionHash,
      tokenExpiry,
    ]);

    await connection.commit();

    logger.info(
      `GrantAccess.js Document ${documentId} shared with ${targetUser}. Token id: ${tokenId}, Transaction hash: ${transactionHash}`
    );
  } catch (error) {
    logger.error(`GrantAccess.js Error in granting access: ${error.message}`);
    if (error.sqlMessage) {
      logger.error(`GrantAccess.js SQL Error: ${error.sqlMessage}`);
    }
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { grantAccess };
