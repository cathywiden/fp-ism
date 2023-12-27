// server/smartContractUtils.js

const { ethers } = require("ethers");
const DocumentAccessControl = require("../../blockchain/artifacts/contracts/DocumentAccessControl.sol/DocumentAccessControl.json");
const logger = require("../utilities/logger");
require("dotenv").config({ path: "../../.env" });

const DACAddress = process.env.CONTRACT_ADDRESS;

const provider = new ethers.providers.JsonRpcProvider(process.env.INFURA_URL);
console.log(process.env.INFURA_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const DAC = new ethers.Contract(
  DACAddress,
  DocumentAccessControl.abi,
  wallet
);

// mint NFT to represent access rights when sharing a document
async function mintAccessToken(targetUserAddress, documentId, metadataURI) {
  logger.info("Minting NFT: access data sent to smart contract");
  try {
    const transaction = await DAC.mintAccess(
      targetUserAddress,
      documentId.toString(),
      metadataURI
    );
    await transaction.wait();

    // return transaction hash to record in DB after minting a token
    const transactionHash = transaction.hash;
    logger.info(
      `Minted NFT for document ${documentId} and user ${targetUserAddress}. Transaction hash: ${transactionHash}`
    );
    return transactionHash;
  } catch (error) {
    logger.error(`Error minting access token: ${error.message}`);
    return null; // return null in case of error
  }
}

// burn NFT to revoke access
async function revokeAccessToken(tokenId) {
  try {
    // Token existence and validity check
    const isTokenValid = await DAC.isTokenValid(tokenId);
    if (!isTokenValid) {
      logger.info(`Token ID ${tokenId} is not valid or already revoked.`);
      return;
    }

    // manual gas limit setting
    const gasLimit = ethers.utils.hexlify(1000000); 
    const transaction = await DAC.revokeAccess(tokenId, {
      gasLimit: gasLimit
    });
    logger.info(`Access revoked for token ID ${tokenId}`);
   
    const transactionHash = transaction.hash;
    logger.info(`Revocation transaction hash: ${transactionHash}`);
    return transactionHash;
  } catch (error) {
    logger.error(`Error revoking access token: ${error.message}`);
    return null;
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

module.exports = {
  mintAccessToken,
  revokeAccessToken,
  checkAccess,
};
