// server/smartContractUtils.js

const { ethers } = require("ethers");
const DocumentAccessControl = require("../../blockchain/artifacts/contracts/DocumentAccessControl.sol/DocumentAccessControl.json");
const logger = require("../utilities/logger");
require("dotenv").config({ path: "../../.env" });

const DACAddress = process.env.CONTRACT_ADDRESS_DAC;

const provider = new ethers.providers.JsonRpcProvider(process.env.INFURA_URL);
console.log(process.env.INFURA_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const DAC = new ethers.Contract(DACAddress, DocumentAccessControl.abi, wallet);

// mint NFT to represent access rights when sharing a document
async function mintAccessToken(
  targetUserAddress,
  documentId,
  documentHash,
  expiryInSeconds
) {
  logger.info("Minting NFT: access data sent to smart contract");
  try {
    logger.info(`Parameters: 
      targetUserAddress: ${targetUserAddress}, 
      documentId: ${documentId}, 
      documentHash: ${documentHash}, 
      expiryInSeconds: ${expiryInSeconds}`);

    const transaction = await DAC.mintAccess(
      targetUserAddress,
      documentId.toString(),
      documentHash,
      expiryInSeconds
    );
    const receipt = await transaction.wait();

    logger.debug(`Transaction receipt: ${JSON.stringify(receipt)}`);

    // massive debugging
    // check if the AccessGranted event is present in the receipt
    const tokenIdEvent = receipt.events.find(
      (event) => event.event === "AccessGranted"
    );

    logger.debug(`GrantAccess.js tokenIdEvent.args: ${tokenIdEvent.args}`);

    if (!tokenIdEvent.args.tokenId) {
      console.error("tokenId undefined in event args");
    }

    if (tokenIdEvent) {
      logger.debug(
        `SmartContractUtils.js AccessGranted event found: ${JSON.stringify(
          tokenIdEvent
        )}`
      );

      const tokenIdBigNumber = tokenIdEvent.args.tokenId;

      logger.debug(
        `SmartContractUtils.js Type of tokenIdBigNumber before conversion: ${typeof tokenIdBigNumber} - Value: ${tokenIdBigNumber}`
      );

      const tokenIdNumber = tokenIdBigNumber.toNumber();

      logger.debug(
        `SmartContractUtils.js Type of tokenIdNumber after conversion: ${typeof tokenIdNumber} - Value: ${tokenIdNumber}`
      );

      return { transactionHash: transaction.hash, tokenId: tokenIdNumber };
    } else {
      logger.error(
        `SmartContractUtils.js AccessGranted event not found in transaction receipt.`
      );
      return { transactionHash: transaction.hash, tokenId: null };
    }
  } catch (error) {
    logger.error(
      `SmartContractUtils.js Error minting access token: ${error.message}`
    );
    return { transactionHash: null, tokenId: null };
  }
}

async function revokeAccessToken(tokenId, reason) {
  logger.info(
    `SmartContractUtils.js Initiating revocation of access token. Token ID: ${tokenId}, Reason: ${reason}`
  );
  try {
    // set a manual gas limit
    const gasLimit = ethers.utils.hexlify(1000000);
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
  logger.info(`SmartContractUtils.js Initiating requestAccess for document with ID ${documentId}`);

  try {
    // set a manual gas limit
    const gasLimit = ethers.utils.hexlify(1000000); 
    logger.debug(`SmartContractUtils.js Gas limit set to: ${gasLimit}`);

    // request access with specified gas limit
    const transaction = await DAC.requestAccess(documentId, requesterAddress, { gasLimit });
    logger.debug(`SmartContractUtils.js Transaction response received: ${JSON.stringify(transaction)}`);

    const transactionHash = transaction.hash;
    logger.info(`SmartContractUtils.js Access requested for user ${requesterAddress} and document ${documentId}. Transaction hash: ${transactionHash}`);
    return transactionHash;
  } catch (error) {
    console.error(`Error requesting access on blockchain: ${error.message}`);
    return null;
  }
}


module.exports = {
  mintAccessToken,
  revokeAccessToken,
  checkAccess,
  requestBlockchainAccess,
};
