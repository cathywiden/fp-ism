// server/access/grantAccess.js

const { getConnection } = require("../utilities/dbConnector");
const logger = require("../utilities/logger");

const { mintAccessToken } = require("../utilities/smartContractUtils");

async function getUserWalletAddress(username) {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      "SELECT wallet_address FROM CONVTEST.blockchain_user_wallet_mappings WHERE username = :username",
      [username]
    );

    if (result.rows.length > 0) {
      return result.rows[0].WALLET_ADDRESS;
    } else {
      logger.error(`Wallet address not found for user: ${username}`);
      return null;
    }
  } catch (error) {
    logger.error(
      `Error fetching wallet address for user ${username}: ${error.message}`
    );
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

async function grantAccess(documentId, targetUser, isProactive = false) {
  let connection;
  try {
    connection = await getConnection();

    // determine the table based on the type of sharing (proactive or in response to a share request)
    const tableName = isProactive
      ? "proactive_document_shares"
      : "document_share_requests";

    // check if the document is already shared with the target user
    const checkResult = await connection.execute(
      `SELECT COUNT(*) AS count FROM ${process.env.DB_USER}.${tableName} WHERE DOCUMENT_ID = :documentId AND TARGET_USER = :targetUser`,
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
      `INSERT INTO ${process.env.DB_USER}.${tableName} (DOCUMENT_ID, TARGET_USER) VALUES (:documentId, :targetUser)`,
      [documentId, targetUser]
    );

    // commit to execute table trigger
    await connection.commit();

    logger.info(`Document ${documentId} shared with ${targetUser}`);

    // Mint NFT for access control
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
          `UPDATE ${process.env.DB_USER}.${tableName} SET TOKEN_TRANSACTION_HASH = :transactionHash WHERE DOCUMENT_ID = :documentId AND TARGET_USER = :targetUser`,
          [transactionHash, documentId, targetUser]
        );
        await connection.commit();
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
