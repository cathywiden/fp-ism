require("dotenv").config({ path: "../.env" });
const logger = require("../utilities/logger");
const { getConnection } = require("../utilities/dbConnector");
const { revokeAccessOnChain } = require("../utilities/smartContractUtils");
const { getTokenId } = require("../utilities/getTokenId");
const { logAction } = require("../utilities/dbUtils");
const eventEmitter = require("../utilities/eventEmitter");

async function revokeAccess(documentId, reason) {
  let connection;
  try {
    connection = await getConnection("user1");

    const { tokenId, targetUser } = await getTokenId(documentId);
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
    if (transactionHash) {
      logger.debug(`Transaction hash: ${transactionHash}`);

      // emit event for toast notif on frontend
      eventEmitter.emit("accessChanged", {
        type: "AccessRevoked",
        recipient: targetUser,
        documentId: documentId,
      });

      logger.info(
        `Event emitted for access change: ${documentId}, ${targetUser}`
      );

      await logAction(connection, "revoke", {
        tokenId: tokenId,
        revokeTime: revokeTime,
        transactionHash: transactionHash,
        reason: reason,
      });

      // delete document from user2's shared table
      const deleteQuery = `DELETE FROM ${process.env.DB_USER2}.${process.env.DB_TABLE_SHARED_DOCS} WHERE DOC_ID = :documentId`;
      logger.debug(`revokeAccess.js Delete query: ${deleteQuery}`);
      await connection.execute(deleteQuery, [documentId]);

      await connection.commit();
      logger.info(
        `revokeAccess.js Revocation and deletion successful for ${documentId}`
      );
    }
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
