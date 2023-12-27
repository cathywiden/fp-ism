// server/utilities/extractwalletAddress.js

const { getConnection } = require("./dbConnector");
const logger = require("./logger");
require("dotenv").config({ path: "../.env" });

async function getUserWalletAddress(username) {
  let connection;
  try {
    // always use "user1" credentials for this query
    connection = await getConnection("user1");

    const query = `SELECT wallet_address FROM ${process.env.DB_USER1}.${process.env.DB_TABLE_WALLET} WHERE username = :username`;
    const result = await connection.execute(query, [username]);

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

module.exports = { getUserWalletAddress };
