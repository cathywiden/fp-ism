// server/smartContractUtils.js

const { ethers } = require("ethers");
const DocumentAccessControl = require("../../blockchain/artifacts/contracts/DocumentAccessControl.sol/DocumentAccessControl.json");
const logger = require("../utilities/logger"); 

const contractAddress = process.env.CONTRACT_ADDRESS;
const provider = new ethers.providers.JsonRpcProvider(process.env.JSON_RPC_PROVIDER);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(contractAddress, DocumentAccessControl.abi, wallet);

// mint NFT to represent access rights when sharing a document
async function mintAccessToken(targetUserAddress, documentId, metadataURI) {
    try {
        const transaction = await contract.mintAccess(targetUserAddress, metadataURI);
        await transaction.wait();
        logger.info(`Minted NFT for document ${documentId} and user ${targetUserAddress}`);
    } catch (error) {
        logger.error(`Error minting access token: ${error.message}`);
    }
}

// burn NFT to revoke access
async function revokeAccessToken(tokenId) {
    try {
        const transaction = await contract.revokeAccess(tokenId);
        await transaction.wait();
        logger.info(`Access revoked for token ID ${tokenId}`);
    } catch (error) {
        logger.error(`Error revoking access token: ${error.message}`);
    }
}

// check if a user has access to a document
async function checkAccess(userAddress, documentId) {
    try {
        const hasAccess = await contract.hasAccess(userAddress, documentId);
        return hasAccess;
    } catch (error) {
        logger.error(`Error checking access: ${error.message}`);
        return false;
    }
}

module.exports = {
    mintAccessToken,
    revokeAccessToken,
    checkAccess
};
