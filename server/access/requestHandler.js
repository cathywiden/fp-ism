// server/access/requestHandler.js

const logger = require("../utilities/logger");
require("dotenv").config({ path: "../.env" });
const { logDenyInDB } = require("../utilities/dbUtils");
const { handleDenyRequest } = require("../utilities/smartContractUtils");

const { getUserWalletAddress } = require("../utilities/extractWalletAddress");

const { mintAccessToken } = require("../utilities/smartContractUtils");

async function denyRequest(documentId, targetUser, reason) {
  try {
    const walletAddress = await getUserWalletAddress(targetUser);
    if (!walletAddress) {
      throw new Error(`No wallet address found for user ${userAddress}`);
    }

    const transactionHash = await handleDenyRequest(
      documentId,
      walletAddress,
      reason
    );

    // log denied request in the DB
    await logDenyInDB(documentId, targetUser, reason, transactionHash);
  } catch (error) {
    logger.error(`Error in denyRequest: ${error.message}`);
  }
}

async function grantRequest(requestData) {
  try {
    const { targetUser, documentId, documentHash, expiryInSeconds } =
      requestData;
    const walletAddress = await getUserWalletAddress(targetUser);
    // check if wallet address is retrieved
    if (!walletAddress) {
      throw new Error(`No wallet address found for user ${targetUser}`);
    }
    // call existing mintAccessToken()
    const { transactionHash, tokenId } = await mintAccessToken(
      walletAddress,
      documentId,
      documentHash,
      expiryInSeconds
    );

    if (transactionHash && tokenId) {
      logger.info(
        `requestHandler.js Access granted for document ${documentId} to user ${targetUser}. Token ID: ${tokenId}, Transaction hash: ${transactionHash}`
      );
    } else {
      logger.error(
        `requestHandler.js Failed to grant access for document ${documentId} to user ${targetUser}.`
      );
    }
  } catch (error) {
    logger.error(`requestHandler.js Error in grantRequest: ${error.message}`);
  }
}

module.exports = { grantRequest, denyRequest };
