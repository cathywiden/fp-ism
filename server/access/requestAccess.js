// server/utilities/requestAccess.js

const logger = require("../utilities/logger");
const { getUserWalletAddress } = require("../utilities/extractWalletAddress");
const { getConnection } = require("../utilities/dbConnector");
const { requestBlockchainAccess } = require("../utilities/smartContractUtils");
const { logRequestDB, doesRequestExist } = require("../utilities/dbUtils");

async function requestAccess(documentId, requester) {
  let connection;
  try {
    connection = await getConnection("user1");

    const duplicateCheck = await doesRequestExist(
      connection,
      documentId,
      requester
    );
    if (duplicateCheck === "No duplicates") {
      const userWalletAddress = await getUserWalletAddress(requester);
      const transactionHash = await requestBlockchainAccess(
        documentId,
        userWalletAddress
      );

      logger.debug(userWalletAddress);

      logger.info(
        `requestAccess.js Submitted blockchain access request in transaction ${transactionHash}`
      );

      if (transactionHash) {
        const requestTime = Math.floor(Date.now() / 1000);
        await logRequestDB(
          connection,
          documentId,
          requester,
          requestTime,
          transactionHash
        );
      }
      return "Request submitted";
    } else {
      return duplicateCheck;
    }
  } catch (error) {
    logger.error(error);
    throw error;
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { requestAccess };
