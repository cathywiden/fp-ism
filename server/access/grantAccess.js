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

    try {
      // mint NFT for access control
      const userWalletAddress = await getUserWalletAddress(targetUser);
      const metadataURI = `doc:${documentId}`; // PLACEHOLDER metadata URI -- document ID

      // mint the access token
      await mintAccessToken(userWalletAddress, documentId, metadataURI);
      // logger.info(`Minted NFT for access to document ${documentId} for user ${targetUser}`);
    } catch (error) {
      logger.error(`Error minting access token: ${error.message}`);
      // error handling?
    }
  } catch (error) {
    logger.error(`Error in granting access: ${error.message}`);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = { grantAccess };
