// server/access/grantAccess.js

require("dotenv").config({ path: "../.env" });
const { getConnection } = require("../utilities/dbConnector");
const logger = require("../utilities/logger");
const { getUserWalletAddress } = require("../utilities/extractWalletAddress");
const { mintAccessToken } = require("../utilities/smartContractUtils");
const { executeBlockchainMockChecksum, checkIfAlreadyShared, checkForExistingRequest, updateExistingRequest, logGrantInDB } = require("../utilities/dbUtils");

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
      logger.info("Document already shared, skipping access grant.");
      return;
    }

    const requestInfo = await checkForExistingRequest(
      connection,
      documentId,
      targetUser
    );

    logger.debug(`requestInfo in grantAccess: ${JSON.stringify(requestInfo)}`);

    const userWalletAddress = await getUserWalletAddress(targetUser);
    const documentHash = await executeBlockchainMockChecksum(documentId);

    const { transactionHash, tokenId } = await mintAccessToken(
      userWalletAddress,
      documentId,
      documentHash,
      expiryInSeconds
    );

    if (!transactionHash || tokenId === null || tokenId === undefined) {
      // logger.error("Token minting failed. No transaction hash or token ID received.");
      // return;
      throw new Error("Token minting failed.");
    } 

    // check if the request already exists and is in "requested" status
    if (requestInfo && requestInfo.requestTxHash) {
      logger.debug("Found existing request, updating it.");

      await updateExistingRequest(
        connection,
        documentId,
        targetUser,
        tokenId,
        transactionHash,
        expiryInSeconds,
        requestInfo
      );
    } else {
      logger.debug("No existing request found with the given criteria. Granting access.");

      await logGrantInDB(
        connection,
        documentId,
        tokenId,
        targetUser,
        transactionHash,
        expiryInSeconds
      );
    }

    logger.info(`Document ${documentId} shared with ${targetUser}. Token id: ${tokenId}, Transaction hash: ${transactionHash}`);
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
