// server/smartContractUtils.js

const { ethers } = require("ethers");

// import contract ABIs
const DocumentAccessControl = require("../../blockchain/artifacts/contracts/DocumentAccessControl.sol/DocumentAccessControl.json");
const Audit = require("../../blockchain/artifacts/contracts/Audit.sol/Audit.json");

const logger = require("./logger");
require("dotenv").config({ path: "../../.env" });

const DACAddress = process.env.CONTRACT_ADDRESS_DAC;

const auditAddress = process.env.CONTRACT_ADDRESS_AUDIT;

const provider = new ethers.providers.JsonRpcProvider(process.env.INFURA_URL);
console.log(process.env.INFURA_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const DAC = new ethers.Contract(DACAddress, DocumentAccessControl.abi, wallet);
const AuditContract = new ethers.Contract(auditAddress, Audit.abi, wallet);

// mint NFT to represent access rights when sharing a document
async function mintAccessToken(
  targetUserAddress,
  documentId,
  documentHash,
  expiryInSeconds
) {
  logger.info("Minting NFT: access data sent to smart contract");
  try {
    // set a manual gas limit
    const gasLimit = ethers.utils.hexlify(1500000);
    logger.debug(`mintAccessToken gas limit set to: ${gasLimit}`);

    logger.info(`Parameters: 
          targetUserAddress: ${targetUserAddress}, 
          documentId: ${documentId}, 
          documentHash: ${documentHash}, 
          expiryInSeconds: ${expiryInSeconds}`);

    const transaction = await DAC.mintAccess(
      targetUserAddress,
      documentId,
      documentHash,
      expiryInSeconds,
      { gasLimit }
    );
    const receipt = await transaction.wait();
    logger.debug(`Transaction receipt: ${JSON.stringify(receipt)}`);

    // find the AccessGranted event in the receipt
    const tokenIdEvent = receipt.events.find(
      (event) => event.event === "AccessGranted"
    );

    if (!tokenIdEvent) {
      throw new Error("AccessGranted event not found in transaction receipt.");
    }

    const tokenIdBigNumber = tokenIdEvent.args.tokenId;
    logger.debug(
      `Type of tokenIdBigNumber before conversion: ${typeof tokenIdBigNumber} - Value: ${tokenIdBigNumber}`
    );

    const tokenIdNumber = tokenIdBigNumber.toNumber();
    logger.debug(
      `Type of tokenIdNumber after conversion: ${typeof tokenIdNumber} - Value: ${tokenIdNumber}`
    );

    return { transactionHash: transaction.hash, tokenId: tokenIdNumber };
  } catch (error) {
    logger.error(`Error minting access token: ${error.message}`);
    throw error;
  }
}

async function revokeAccessToken(tokenId, reason) {
  logger.info(
    `SmartContractUtils.js Initiating revocation of access token. Token ID: ${tokenId}, Reason: ${reason}`
  );
  try {
    // set a manual gas limit
    const gasLimit = ethers.utils.hexlify(1500000);
    logger.debug(`SmartContractUtils.js Gas limit set to: ${gasLimit}`);

    // revoke access
    const transaction = await DAC.revokeAccess(tokenId, reason, { gasLimit });
    logger.debug(
      `SmartContractUtils.js Transaction response received: ${JSON.stringify(
        transaction
      )}`
    );

    const transactionHash = transaction.hash;
    logger.info(
      `SmartContractUtils.js Access revoked for token ID ${tokenId}. Transaction hash: ${transactionHash}`
    );

    return transactionHash;
  } catch (error) {
    logger.error(
      `SmartContractUtils.js Error revoking access token: ${error.message}`
    );
    if (error.transaction) {
      logger.error(
        `SmartContractUtils.js Transaction data: ${JSON.stringify(
          error.transaction
        )}`
      );
    }
    return null; // return null in case of error
  }
}

// check if a user has access to a document
async function checkAccess(userAddress, documentId) {
  try {
    const hasAccess = await DAC.hasAccess(userAddress, documentId);
    return hasAccess;
  } catch (error) {
    logger.error(`Error checking access: ${error.message}`);
    return false;
  }
}

// request access to a document on the blockchain
async function requestBlockchainAccess(documentId, requesterAddress) {
  logger.info(
    `SmartContractUtils.js Initiating requestAccess for document with ID ${documentId}`
  );

  try {
    // set a manual gas limit
    const gasLimit = ethers.utils.hexlify(1000000);
    logger.debug(`SmartContractUtils.js Gas limit set to: ${gasLimit}`);

    // request access with specified gas limit
    const transaction = await DAC.requestAccess(documentId, requesterAddress, {
      gasLimit,
    });
    logger.debug(
      `SmartContractUtils.js Transaction response received: ${JSON.stringify(
        transaction
      )}`
    );

    const transactionHash = transaction.hash;
    logger.info(
      `SmartContractUtils.js Access requested for user ${requesterAddress} and document ${documentId}. Transaction hash: ${transactionHash}`
    );
    return transactionHash;
  } catch (error) {
    console.error(`Error requesting access on blockchain: ${error.message}`);
    return null;
  }
}

async function handleDenyRequest(documentId, targetUser, reason) {
  try {
    const gasLimit = ethers.utils.hexlify(1000000);
    logger.debug(`Gas limit set to: ${gasLimit}`);

    const transaction = await DAC.denyRequest(documentId, targetUser, reason, {
      gasLimit,
    });
    const transactionHash = transaction.hash;

    // logger.debug(`Transaction hash: ${transactionHash}`);

    logger.info(
      `Access denied for user ${targetUser} and document ${documentId}. Transaction hash: ${transactionHash}`
    );
    return transactionHash;
  } catch (error) {
    logger.error(`Error in handleDenyRequest: ${error.message}`);
    throw error;
  }
}

// logs tampering of a document to the blockchain
async function logTampering(documentId, oldHash, newHash) {
  try {
    logger.info(`Logging tampering for document: ${documentId}`);
    const transaction = await AuditContract.logTampering(
      documentId,
      oldHash,
      newHash
    );

    // return the transaction hash
    await transaction.wait();
    logger.debug(`Transaction hash: ${transaction.hash}`);
    return transaction.hash;
  } catch (error) {
    logger.error(`Error logging tampering: ${error.message}`);
    return null;
  }
}

module.exports = {
  mintAccessToken,
  revokeAccessToken,
  checkAccess,
  requestBlockchainAccess,
  handleDenyRequest,
  logTampering,
};
