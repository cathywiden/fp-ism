// middlewares/roleDetermination.js

require("dotenv").config({ path: "../../.env" });
const { getConnection } = require("../utilities/dbConnector");
const logger = require("../utilities/logger"); 

async function determineUserRole(req, res, next) {
  let connection; 
  const walletAddress = req.user.walletAddress;

  logger.debug(`Determining role for wallet address: ${walletAddress}`);

  try {
    connection = await getConnection("user1");
    const query = `SELECT role FROM ${process.env.DB_TABLE_WALLET} WHERE wallet_address = :walletAddress`;
    logger.debug(`Executing query: ${query}`);

    const result = await connection.execute(query, [walletAddress]);

    if (result.rows.length > 0) {
      req.user.role = result.rows[0].ROLE; // set the user role in the request object
      logger.debug(`Role found: ${req.user.role}`);
      next();
    } else {
      logger.debug('Role not found for the given wallet address');
      res.status(404).send('Role not found for the given wallet address');
    }
  } catch (error) {
    logger.error('Error in determining user role:', error.message);
    res.status(500).send('Internal Server Error');
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = { determineUserRole };
