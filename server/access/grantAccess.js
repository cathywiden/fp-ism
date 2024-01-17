// server/access/grantAccess.js

require("dotenv").config({ path: "../.env" });
const { getConnection } = require("../utilities/dbConnector");
const logger = require("../utilities/logger");
const eventEmitter = require("../utilities/eventEmitter");
const { getUserWalletAddress } = require("../utilities/extractWalletAddress");
const { mintAccessOnChain } = require("../utilities/smartContractUtils");
const {
  executeBlockchainMockChecksum,
  checkIfAlreadyShared,
  checkForExistingRequest,
  logAction,
} = require("../utilities/dbUtils");

async function grantAccess(
  documentId,
  targetUser,
  documentHash,
  expiryInSeconds
) {
  let connection;
  try {
    connection = await getConnection("user1");

    if (await checkIfAlreadyShared(connection, documentId, targetUser)) {
      logger.info(
        `Document ${documentId} already shared with ${targetUser}, skipping access grant.`
      );
      return; // exit early if doc already shared
    }

    // check if there is an unprocessed request 
    // from the same user, for the same doc
    // would be more reliable to check on-chain,
    // using checkForExistingrequestOnChain() 
    const requestInfo = await checkForExistingRequest(
      connection,
      documentId,
      targetUser
    );
    logger.debug(`requestInfo in grantAccess: ${JSON.stringify(requestInfo)}`);

    const userWalletAddress = await getUserWalletAddress(targetUser);
    const documentHash = await executeBlockchainMockChecksum(documentId);

    const { transactionHash, tokenId } = await mintAccessOnChain(
      userWalletAddress,
      documentId,
      documentHash,
      expiryInSeconds
    );

    // emit event for toast notif on frontend
    eventEmitter.emit("accessChanged", {
      type: "AccessGranted",
      recipient: targetUser,
      documentId: documentId,
    });
    logger.info(
      `Event emitted for access change: ${documentId}, ${targetUser}`
    );

    if (!transactionHash || tokenId === null || tokenId === undefined) {
      throw new Error("Token minting failed.");
    }

    if (requestInfo && requestInfo.requestTxHash) {
      logger.debug("Found existing request, updating it.");

      // update the existing request
      await logAction(connection, "update-grant", {
        documentId: documentId,
        tokenId: tokenId,
        targetUser: targetUser,
        transactionHash: transactionHash,
        expiryInSeconds: expiryInSeconds,
      });
    } else {
      logger.debug(
        "No existing request found with the given criteria. Granting access."
      );

      // create new grant
      await logAction(connection, "grant", {
        documentId: documentId,
        tokenId: tokenId,
        targetUser: targetUser,
        transactionHash: transactionHash,
        expiryInSeconds: expiryInSeconds,
      });
    }

    logger.info(
      `Document ${documentId} shared with ${targetUser}. Token id: ${tokenId}, Transaction hash: ${transactionHash}`
    );
  } catch (error) {
    logger.error(`Error in granting access: ${error.message}`);
    if (error.sqlMessage) {
      logger.error(`SQL Error: ${error.sqlMessage}`);
    }
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { grantAccess };
