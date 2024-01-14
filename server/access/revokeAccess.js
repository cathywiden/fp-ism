// server/access/revokeAccess.js

require("dotenv").config({ path: "../.env" });
const logger = require("../utilities/logger");

const { getConnection } = require("../utilities/dbConnector");
const { revokeAccessOnChain } = require("../utilities/smartContractUtils");
const { getTokenId } = require("../utilities/getTokenId");

async function revokeAccess(documentId, reason, targetUser) {
  let connection;
  try {
    connection = await getConnection("user1");

    const tokenId = await getTokenId(documentId);

    logger.info(`revokeAccess.js Token ID for revocation: ${tokenId}`);

    if (!tokenId) {
      logger.error(
        `revokeAccess.js No token found for document ID: ${documentId}`
      );
      return;
    }

    const revokeTime = Math.floor(Date.now() / 1000);
    const transactionHash = await revokeAccessOnChain(tokenId, reason);
    logger.info(
      `revokeAccess.js Transaction hash for revocation: ${transactionHash}`
    );

    // update the table based on tokenId
    const revokeQuery = `UPDATE ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} SET REV_TS = :revokeTime, REV_TX_HASH = :transactionHash, REASON = :reason, STATUS = 'revoked' WHERE TOKEN_ID = :tokenId`;

    logger.debug(`revokeAccess.js Revoke query: ${revokeQuery}`);

    await connection.execute(revokeQuery, {
      tokenId: tokenId,
      revokeTime: revokeTime,
      transactionHash: transactionHash,
      reason: reason,
    });

    const deleteQuery = `DELETE FROM ${process.env.DB_USER2}.${process.env.DB_TABLE_SHARED_DOCS} WHERE DOC_ID = :documentId`;
    logger.debug(`revokeAccess.js Delete query: ${deleteQuery}`);
    await connection.execute(deleteQuery, [documentId]);

    await connection.commit();
    logger.info(
      `revokeAccess.js Revocation and deletion successful for ${documentId}`
    );
  } catch (error) {
    logger.error(
      `revokeAccess.js Error in executing revokeAccess: ${error.message}`
    );
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = { revokeAccess };
