// server/utils/smartContractUtils.js

require("dotenv").config({ path: "../../.env" });
const { ethers } = require("ethers");
const logger = require("./logger");

const provider = new ethers.providers.JsonRpcProvider(process.env.INFURA_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// import contract ABIs
const DocumentAccessControl = require("../../blockchain/artifacts/contracts/DocumentAccessControl.sol/DocumentAccessControl.json");
const Audit = require("../../blockchain/artifacts/contracts/Audit.sol/Audit.json");

const DACAddress = process.env.CONTRACT_ADDRESS_DAC;
const auditAddress = process.env.CONTRACT_ADDRESS_AUDIT;

const DAC = new ethers.Contract(DACAddress, DocumentAccessControl.abi, wallet);
const AuditContract = new ethers.Contract(auditAddress, Audit.abi, wallet);

// standard gas limit
const STANDARD_GAS_LIMIT = ethers.utils.hexlify(1500000);

// standardized transaction execution function
async function executeTransaction(contractMethod, ...args) {
  try {
    const transaction = await contractMethod(...args, {
      gasLimit: STANDARD_GAS_LIMIT,
    });
    const receipt = await transaction.wait();
    return { transaction, receipt };
  } catch (error) {
    logger.error(`Error executing transaction: ${error.message}`);
    throw error;
  }
}

// mint NFT to represent access rights to a document
async function mintAccessOnChain(
  targetUserAddress,
  documentId,
  documentHash,
  expiryInSeconds
) {
  logger.info("Minting NFT: access data sent to smart contract");

  try {
    const { transaction, receipt } = await executeTransaction(
      DAC.mintAccess,
      targetUserAddress,
      documentId,
      documentHash,
      expiryInSeconds
    );

    // process receipt to find tokenId
    const tokenIdEvent = receipt.events.find(
      (event) => event.event === "AccessGranted"
    );
    if (!tokenIdEvent)
      throw new Error("AccessGranted event not found in transaction receipt.");

    const tokenIdNumber = tokenIdEvent.args.tokenId.toNumber();
    return { transactionHash: transaction.hash, tokenId: tokenIdNumber };
  } catch (error) {
    logger.error(`Error minting access token: ${error.message}`);
    throw error;
  }
}

// revoke access for a certain document
async function revokeAccessOnChain(tokenId, reason) {
  logger.info(
    `Initiating revocation of access token. Token ID: ${tokenId}, Reason: ${reason}`
  );

  try {
    const { transaction } = await executeTransaction(
      DAC.revokeAccess,
      tokenId,
      reason
    );

    const transactionHash = transaction.hash;
    logger.info(
      `Access revoked for token ID ${tokenId}. Transaction hash: ${transactionHash}`
    );
    return transactionHash;
  } catch (error) {
    logger.error(`Error revoking access token: ${error.message}`);
    if (error.transaction) {
      logger.error(`Transaction data: ${JSON.stringify(error.transaction)}`);
    }
    return null;
  }
}

// request access to a document
async function requestAccessOnChain(documentId, requesterAddress) {
  logger.info(`Initiating requestAccess for document with ID ${documentId}`);

  try {
    const { transaction } = await executeTransaction(
      DAC.requestAccess,
      documentId,
      requesterAddress
    );

    const transactionHash = transaction.hash;
    logger.info(
      `Access requested for user ${requesterAddress} and document ${documentId}. Transaction hash: ${transactionHash}`
    );
    return transactionHash;
  } catch (error) {
    logger.error(`Error requesting access on blockchain: ${error.message}`);
    return null; // return null in case of error
  }
}

// deny request
async function denyRequestOnChain(documentId, targetUser, reason) {
  logger.debug(
    `Initiating denyRequest for document ${documentId} and user ${targetUser}`
  );

  try {
    const { transaction } = await executeTransaction(
      DAC.denyRequest,
      documentId,
      targetUser,
      reason
    );

    const transactionHash = transaction.hash;
    logger.info(
      `Access denied for user ${targetUser} and document ${documentId}. Transaction hash: ${transactionHash}`
    );
    return transactionHash;
  } catch (error) {
    logger.error(`Error in denyRequestOnChain: ${error.message}`);
    throw error;
  }
}

// renew access for an expired token
async function renewAccessOnChain(tokenId, additionalTimeInSeconds) {
  logger.info(`Initiating renew access for token ID: ${tokenId}`);

  try {
    const { transaction } = await executeTransaction(
      DAC.renewAccess,
      tokenId,
      additionalTimeInSeconds
    );

    const transactionHash = transaction.hash;
    logger.info(
      `Access renewed for token ID ${tokenId}. Transaction hash: ${transactionHash}`
    );
    return transactionHash;
  } catch (error) {
    logger.error(
      `Error renewing access for token ID ${tokenId}: ${error.message}`
    );
    throw error;
  }
}

// check whether user has access to a document
async function checkAccessOnChain(userAddress, documentId) {
  logger.info(
    `Checking access for user ${userAddress} on document ${documentId}`
  );

  try {
    logger.info(`Inside try block: Document ID: ${documentId}`);

    const hasAccess = await DAC.hasAccess(userAddress, documentId);

    return hasAccess;
  } catch (error) {
    logger.error(
      `Error checking access for user ${userAddress} on document ${documentId}: ${error.message}`
    );
    return false;
  }
}

// get all revoked documents
async function getRevokedTokensOnChain(documentId) {
  logger.info(`Fetching revoked tokens for document ${documentId}`);

  try {
    const revokedTokens = await DAC.getRevokedTokens(documentId);
    logger.debug(`Revoked tokens for document ${documentId}: ${revokedTokens}`);
    return revokedTokens;
  } catch (error) {
    logger.error(
      `Error fetching revoked tokens for document ${documentId}: ${error.message}`
    );
    throw error;
  }
}

// logs tampering of a document to the blockchain
async function logTamperingOnChain(documentId, oldHash, newHash) {
  logger.info(`Initiating tampering log for document: ${documentId}`);

  try {
    const { transaction } = await executeTransaction(
      AuditContract.logTampering,
      documentId,
      oldHash,
      newHash
    );

    const transactionHash = transaction.hash;
    logger.debug(
      `Tampering logged for document ${documentId}. Transaction hash: ${transactionHash}`
    );
    return transactionHash;
  } catch (error) {
    logger.error(
      `Error logging tampering for document ${documentId}: ${error.message}`
    );
    return null;
  }

  //////// newly implemented
  // check if a request is pending
  // would be more reliable check for an existing request than a DB check that can lag
  async function isRequestPendingOnChain(documentId, requesterAddress) {
    logger.info(
      `Checking if request is pending for document ${documentId} and requester ${requesterAddress}`
    );

    try {
      const isPending = await DAC.isRequestPending(
        documentId,
        requesterAddress
      );
      return isPending;
    } catch (error) {
      logger.error(
        `Error checking if request is pending for document ${documentId} and requester ${requesterAddress}: ${error.message}`
      );
      throw error;
    }
  }

  // check if a token is valid
  async function isTokenValidOnChain(tokenId) {
    logger.info(`Checking if token ID ${tokenId} is valid`);

    try {
      const { transaction } = await executeTransaction(
        DAC.isTokenValid,
        tokenId
      );

      const receipt = await transaction.wait();
      const isValid = receipt.events.some(
        (event) =>
          event.event === "TokenExpired" && event.args.tokenId.eq(tokenId)
      );

      logger.info(
        `Token ID ${tokenId} validity check complete. Is valid: ${isValid}`
      );
      return isValid;
    } catch (error) {
      logger.error(
        `Error checking validity for token ID ${tokenId}: ${error.message}`
      );
      throw error;
    }
  }

  // extract data for a specific token
  async function getTokenDataOnChain(tokenId) {
    logger.info(`Fetching data for token ID: ${tokenId}`);

    try {
      const tokenData = await DAC.getTokenData(tokenId);

      // destructuring the response for logging purposes
      const { owner, expiryTime, isValid, isRevoked, revokedTimestamp } =
        tokenData;

      logger.debug(`Data for token ID ${tokenId}: 
                  Owner: ${owner}, 
                  Expiry Time: ${expiryTime}, 
                  Is Valid: ${isValid}, 
                  Is Revoked: ${isRevoked}, 
                  Revoked Timestamp: ${revokedTimestamp}`);

      return { owner, expiryTime, isValid, isRevoked, revokedTimestamp };
    } catch (error) {
      logger.error(
        `Error fetching data for token ID ${tokenId}: ${error.message}`
      );
      throw error;
    }
  }

  // detailed information about a token && its history
  async function getTokenDetailsOnChain(tokenId) {
    logger.info(`Fetching details for token ID: ${tokenId}`);

    try {
      const tokenDetails = await DAC.getTokenDetails(tokenId);

      // destructure!
      const { owner, expiryTime, isRevoked, revokedTimestamp, history } =
        tokenDetails;

      logger.debug(`Details for token ID ${tokenId}: 
                  Owner: ${owner}, 
                  Expiry Time: ${expiryTime}, 
                  Is Revoked: ${isRevoked}, 
                  Revoked Timestamp: ${revokedTimestamp}, 
                  History: ${JSON.stringify(history)}`);

      return { owner, expiryTime, isRevoked, revokedTimestamp, history };
    } catch (error) {
      logger.error(
        `Error fetching details for token ID ${tokenId}: ${error.message}`
      );
      throw error;
    }
  }

  // transfer ownership to the backup owner
  async function transferOwnershipToBackupOnChain() {
    logger.info(`Initiating transfer of ownership to backup owner`);

    try {
      const { transaction } = await executeTransaction(
        DAC.transferOwnershipToBackup
      );

      const transactionHash = transaction.hash;
      logger.info(
        `Ownership transfer initiated. Transaction hash: ${transactionHash}`
      );
      return transactionHash;
    } catch (error) {
      logger.error(
        `Error transferring ownership to backup owner: ${error.message}`
      );
      throw error;
    }
  }
}

module.exports = {
  mintAccessOnChain,
  revokeAccessOnChain,
  checkAccessOnChain,
  requestAccessOnChain,
  denyRequestOnChain,
  renewAccessOnChain,
  logTamperingOnChain,
  getRevokedTokensOnChain,
};
