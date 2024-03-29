require("dotenv").config({ path: "../.env" });
const { getConnection } = require("../utilities/dbConnector");
const logger = require("../utilities/logger");
const eventEmitter = require("../utilities/eventEmitter");
const { logAction, checkForExistingRequest } = require("../utilities/dbUtils");
const { denyRequestOnChain } = require("../utilities/smartContractUtils");
const { getUserWalletAddress } = require("../utilities/extractWalletAddress");

async function denyRequest(documentId, targetUser, reason) {
  let connection;
  try {
    connection = await getConnection("user1");

    const requestInfo = await checkForExistingRequest(
      connection,
      documentId,
      targetUser
    );

    if (requestInfo && requestInfo.requestTxHash) {
      logger.info("Found existing request, updating it.");
      logger.debug(`requestInfo in denyAccess: ${JSON.stringify(requestInfo)}`);

      const walletAddress = await getUserWalletAddress(targetUser);
      if (!walletAddress) {
        throw new Error(`No wallet address found for user ${targetUser}`);
      }

      const transactionHash = await denyRequestOnChain(
        documentId,
        walletAddress,
        reason
      );

      if (transactionHash) {
        logger.debug(`Transaction hash: ${transactionHash}`);

        // emit event for toast notif on frontend
        eventEmitter.emit("accessChanged", {
          type: "AccessDenied",
          recipient: targetUser,
          documentId: documentId,
        });

        await logAction(connection, "deny", {
          documentId: documentId,
          targetUser: targetUser,
          reason: reason,
          transactionHash: transactionHash,
        });
      } else {
        logger.error("Deny operation failed. No transaction hash received.");
      }
    } else {
      logger.debug(
        "No existing request found with the given criteria. Denying access."
      );
    }
  } catch (error) {
    logger.error(`Error in denying access: ${error.message}`);
    if (error.sqlMessage) {
      logger.error(`SQL Error: ${error.sqlMessage}`);
    }
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { denyRequest };
