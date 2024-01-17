const logger = require("../utilities/logger");
const eventEmitter = require("../utilities/eventEmitter");
const { getUserWalletAddress } = require("../utilities/extractWalletAddress");
const { getConnection } = require("../utilities/dbConnector");
const { requestAccessOnChain } = require("../utilities/smartContractUtils");
const { logAction, doesRequestExist } = require("../utilities/dbUtils");

async function requestAccess(documentId, requester) {
  let connection;
  try {
    connection = await getConnection("user1");

    const duplicateCheck = await doesRequestExist(
      connection,
      documentId,
      requester
    );

    if (duplicateCheck === "No duplicates") {
      const userWalletAddress = await getUserWalletAddress(requester);
      const transactionHash = await requestAccessOnChain(
        documentId,
        userWalletAddress
      );

      logger.debug(userWalletAddress);

      logger.info(
        `requestAccess.js Submitted blockchain access request in transaction ${transactionHash}`
      );

      if (transactionHash) {
        const requestTime = Math.floor(Date.now() / 1000);
        await logAction(connection, "request", {
          documentId: documentId,
          requester: requester,
          requestTime: requestTime,
          transactionHash: transactionHash,
        });

        // emit event for toast notif on frontend
        eventEmitter.emit("accessChanged", {
          type: "AccessRequested",
          recipient: requester,
          documentId: documentId,
        });
        logger.info(
          `Event emitted for access change: ${documentId}, ${requester}`
        );
        return "Request submitted";
      }
    } else {
      return duplicateCheck;
    }
  } catch (error) {
    logger.error(error);
    throw error;
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { requestAccess };
