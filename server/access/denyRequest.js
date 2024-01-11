// server/access/denyRequest.js
const { getConnection } = require("../utilities/dbConnector");
const logger = require("../utilities/logger");
require("dotenv").config({ path: "../.env" });
const {
  logDenyInDB,
  updateExistingRequestForDeny,
  checkForExistingRequest,
} = require("../utilities/dbUtils");
const { handleDenyRequest } = require("../utilities/smartContractUtils");

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

    if (requestInfo) {
      logger.debug("Found existing request, updating it.");
      logger.debug(`requestInfo in denyAccess: ${JSON.stringify(requestInfo)}`);

      const walletAddress = await getUserWalletAddress(targetUser);
      if (!walletAddress) {
        throw new Error(`No wallet address found for user ${targetUser}`);
      }

      const transactionHash = await handleDenyRequest(
        documentId,
        walletAddress,
        reason
      );

      logger.debug(`Transaction hash: ${transactionHash}`);

      if (!transactionHash) {
        logger.error("Deny operation failed. No transaction hash received.");
        return;
      }

      // check if the request already exists and is in "requested" status
      if (requestInfo && requestInfo.requestTxHash) {
        logger.debug("Found existing request, updating it.");

        await updateExistingRequestForDeny(
          connection,
          documentId,
          targetUser,
          reason,
          transactionHash,
          requestInfo
        );

        logger.debug(`Am I here in denyRequest?`);
      } else {
        logger.debug(
          "No existing request found with the given criteria. Denying access."
        );

        // Log denied request in the DB
        await logDenyInDB(
          connection,
          documentId,
          targetUser,
          reason,
          transactionHash,
          requestInfo
        );
      }
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
