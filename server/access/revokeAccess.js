// server/access/revokeAccess.js

require("dotenv").config({ path: "../.env" });
const logger = require("../utilities/logger");

const { getConnection } = require("../utilities/dbConnector");
const { revokeAccessToken } = require("../utilities/smartContractUtils");
const { getTokenId } = require("./tokenUtils");

async function revokeAccess(documentId, reason) {
  let connection;
  try {
    connection = await getConnection("user1");

    logger.debug("Starting revokeAccess function");

    const tokenId = await getTokenId(documentId);
    logger.info(`Token ID for revocation: ${tokenId}`);
    if (!tokenId) {
      logger.error(`No token found for document ID: ${documentId}`);
      return;
    }

    const revokeTime = Math.floor(Date.now() / 1000);
    const transactionHash = await revokeAccessToken(tokenId);
    logger.info(`Transaction hash for revocation: ${transactionHash}`);

    const revokeQuery = `INSERT INTO ${process.env.DB_USER1}.${process.env.DB_TABLE_REVOKED} (DOCUMENT_ID, REVOKED_TIME, REVOKE_TRANSACTION_HASH, REVOCATION_REASON) VALUES (:documentId, :revokeTime, :transactionHash, :reason)`;
    logger.debug(`Revocation query: ${revokeQuery}`);
    
    await connection.execute(revokeQuery, [
      documentId,
      revokeTime,
      transactionHash,
      reason,
    ]);

    const deleteQuery = `DELETE FROM ${process.env.DB_USER2}.${process.env.DB_TABLE_SHARED_DOCS} WHERE DOCUMENT_ID = :documentId`;
    logger.debug(`Delete query: ${deleteQuery}`);
    await connection.execute(deleteQuery, [documentId]);

    await connection.commit();
    logger.info(`Revocation and deletion successful for ${documentId}`);
  } catch (error) {
    logger.error(`Error in executing revokeAccess: ${error.message}`);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = { revokeAccess };
