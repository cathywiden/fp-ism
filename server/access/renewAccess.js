const { getConnection } = require("../utilities/dbConnector");
const logger = require("../utilities/logger");
const eventEmitter = require("../utilities/eventEmitter");
const { renewAccessOnChain } = require("../utilities/smartContractUtils");
const { logAction } = require("../utilities/dbUtils");
const { getTokenId } = require("../utilities/getTokenId");

async function renewAccess(documentId, additionalTimeInSeconds) {
  logger.debug(`Renewing access for documentId ${documentId}`);

  let connection;
  try {
    connection = await getConnection("user1");

    // get tokenId for docId
    const tokenData = await getTokenId(documentId);
    const tokenId = tokenData.tokenId;
    const targetUser = tokenData.targetUser;

    logger.debug(`Token to renew: ${tokenId}`);

    if (!tokenId) {
      throw new Error(`No token found for document ID: ${documentId}`);
    }

    // renew access only if the token exists and is expired
    const currentTime = Math.floor(Date.now() / 1000);
    const newExpiryTime = currentTime + additionalTimeInSeconds;

    const transactionHash = await renewAccessOnChain(tokenId, newExpiryTime);

    // emit event for toast notif on frontend
    eventEmitter.emit("accessChanged", {
      type: "AccessRenewed",
      recipient: targetUser,
      documentId: documentId,
    });
    logger.info(
      `Event emitted for access change: ${documentId}, ${targetUser}`
    );

    await logAction(connection, "renew", {
      tokenId: tokenId,
      tokenExpiry: newExpiryTime,
      transactionHash: transactionHash,
      renewTime: currentTime,
    });

    logger.info(
      `Token ${tokenId} renewed successfully. Transaction hash: ${transactionHash}`
    );
    return transactionHash;
  } catch (error) {
    logger.error(
      `Error renewing access for document ID ${documentId}: ${error.message}`
    );
    throw error;
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { renewAccess };
