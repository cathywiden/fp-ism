// server/access/grantAccess.js

const { getConnection } = require("../utilities/dbConnector");
const logger = require("../utilities/logger");
require("dotenv").config({ path: "../.env" });

const { getUserWalletAddress } = require("../access/extractWalletAddress");

const { mintAccessToken } = require("../utilities/smartContractUtils");

async function grantAccess(documentId, targetUser, isProactive = false) {
    let connection;
    try {
      connection = await getConnection("user1");
      const tableName = isProactive ? process.env.DB_TABLE_SHARE_PROACTIVE : process.env.DB_TABLE_SHARE_ON_REQUEST;
  
      // Check for existing share
      const checkResult = await connection.execute(
        `SELECT COUNT(*) AS count FROM ${tableName} WHERE DOCUMENT_ID = :documentId AND TARGET_USER = :targetUser`,
        [documentId, targetUser]
      );
      if (checkResult.rows[0].COUNT > 0) {
        logger.info(`Document ${documentId} already shared with ${targetUser}`);
        return;
      }
  
      // Mint token and get current Unix timestamps
      const userWalletAddress = await getUserWalletAddress(targetUser);
      const metadataURI = `doc:${documentId}`;
      const transactionHash = await mintAccessToken(userWalletAddress, documentId, metadataURI);
      if (!transactionHash) {
        logger.error("Token minting failed. No transaction hash received.");
        return;
      }
      const shareTime = Math.floor(Date.now() / 1000);
      const tokenExpiry = shareTime + 604800; // 1 week in seconds
  
      // insert into CONVTEST and BCCONV tables
      await connection.execute(
        `INSERT INTO ${tableName} (DOCUMENT_ID, TARGET_USER, SHARE_TIME, TOKEN_TRANSACTION_HASH, TOKEN_EXPIRY) VALUES (:documentId, :targetUser, :shareTime, :transactionHash, :tokenExpiry)`,
        [documentId, targetUser, shareTime, transactionHash, tokenExpiry]
      );
      await connection.commit();
      logger.info(`Document ${documentId} shared with ${targetUser} and token minted successfully`);
  
    } catch (error) {
      logger.error(`Error in granting access: ${error.message}`);
    } finally {
      if (connection) await connection.close();
    }
  }
  
  module.exports = { grantAccess };
  