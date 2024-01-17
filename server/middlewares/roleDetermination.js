require("dotenv").config({ path: "../../.env" });
const { getConnection } = require("../utilities/dbConnector");
const logger = require("../utilities/logger");

// mapping token "user1" and "user2" to DB credentials
const userToDbUserMap = {
  user1: process.env.DB_USER1,
  user2: process.env.DB_USER2,
};

async function determineUserRole(req, res, next) {
  // only proceed if JWT user is available
  if (req.user) {
    let connection;
    const walletAddress = req.user.walletAddress;
    const dbUser = userToDbUserMap[req.user.username]; // map JWT username to DB user

    logger.debug(
      `Determining role for DB user: ${dbUser} with wallet address: ${walletAddress}`
    );
    req.dbUser = dbUser; // attach resolved DB username to the req object

    logger.debug(`Mapped JWT username to DB user: ${dbUser}`);

    try {
      connection = await getConnection("user1");
      const query = `SELECT role FROM ${process.env.DB_TABLE_WALLET} WHERE username = :dbUser`;
      logger.debug(`Executing query: ${query}`);

      const result = await connection.execute(query, { dbUser });

      if (result.rows.length > 0) {
        req.user.role = result.rows[0].ROLE; // set the user role in req object
        logger.debug(`Role found: ${req.user.role}`);
        next();
      } else {
        logger.debug("Role not found for the given DB user");
        res.status(404).send("Role not found for the given DB user");
      }
    } catch (error) {
      logger.error("Error in determining user role:", error.message);
      res.status(500).send("Internal Server Error");
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  } else {
    next(); // skip to next middleware or route handler
  }
}

module.exports = { determineUserRole };
