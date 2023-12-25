// server/access/extractWalletAddress.js

const { getConnection } = require("../utilities/dbConnector");
const logger = require("../utilities/logger");
require("dotenv").config({ path: "../.env" });

async function getUserWalletAddress(username) {
    let connection;
    try {
      // always use "user1" credentials for this query
      connection = await getConnection("user1");
  
      // in SQL query, concatenate process.env.DB_USER1 with the SQL query string!
  
      /* const result = await connection.execute(
      "SELECT wallet_address FROM ${process.env.DB_USER1}.blockchain_user_wallet_mappings WHERE username = :username",
          [username]
        ); */ // this way it won't work
      const query =
        "SELECT wallet_address FROM " +
        process.env.DB_USER1 +
        ".blockchain_user_wallet_mappings WHERE username = :username";
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