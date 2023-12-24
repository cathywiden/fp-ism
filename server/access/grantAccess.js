// server/access/grantAccess.js

const { getConnection } = require("../utilities/dbConnector");
const logger = require("../utilities/logger");
require("dotenv").config({ path: "../.env" });

const { getUserWalletAddress } = require("../access/extractWalletAddress");

const { mintAccessToken } = require("../utilities/smartContractUtils");

async function grantAccess(documentId, targetUser, isProactive = false) {
  let connection;
  try {
    // always use "user1" credentials for this query
    connection = await getConnection("user1");

    // determine the table based on the type of sharing (proactive or in response to a share request)
    const tableName = isProactive
      ? "proactive_document_shares"
      : "document_share_requests";

    // check if the document is already shared with the target user
    const checkResult = await connection.execute(
      `SELECT COUNT(*) AS count FROM ${process.env.DB_USER1}.${tableName} WHERE DOCUMENT_ID = :documentId AND TARGET_USER = :targetUser`,
      [documentId, targetUser]
    );

    if (checkResult.rows[0].COUNT > 0) {
      logger.info(
        `Document ${documentId} is already shared with ${targetUser}`
      );
      return; // skip insertion if already shared!
    }

    // insert into the appropriate table
    await connection.execute(
      `INSERT INTO ${process.env.DB_USER1}.${tableName} (DOCUMENT_ID, TARGET_USER) VALUES (:documentId, :targetUser)`,
      [documentId, targetUser]
    );

    // commit to execute table trigger
    await connection.commit();

    logger.info(`Document ${documentId} shared with ${targetUser}`);

    // mint NFT for access control
    try {
      const userWalletAddress = await getUserWalletAddress(targetUser);
      const metadataURI = `doc:${documentId}`; // PLACEHOLDER metadata URI -- document ID

      const transactionHash = await mintAccessToken(
        userWalletAddress,
        documentId,
        metadataURI
      );
      logger.info(`Token transaction hash: ${transactionHash}`);

      if (transactionHash) {
        // insert token minting transaction hash into the appropriate table
        await connection.execute(
          `UPDATE ${process.env.DB_USER1}.${tableName} SET TOKEN_TRANSACTION_HASH = :transactionHash WHERE DOCUMENT_ID = :documentId AND TARGET_USER = :targetUser`,
          [transactionHash, documentId, targetUser]
        );
        await connection.commit();
        logger.info("Token minting transaction hash logged in database");
      } else {
        logger.error("Token minting failed. No transaction hash received.");
      }
    } catch (error) {
      logger.error(`Error minting access token: ${error.message}`);
      // error handling? rollback?
    }
  } catch (error) {
    logger.error(`Error in granting access: ${error.message}`);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = { grantAccess };
