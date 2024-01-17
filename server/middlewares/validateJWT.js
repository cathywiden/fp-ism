require("dotenv").config({ path: "../../.env" });
const jwt = require("jsonwebtoken");
const logger = require("../utilities/logger");

const secretKey = process.env.JWT_SECRET_KEY;

function validateJWT(req, res, next) {
  const tokenHeader = req.headers["authorization"];
  logger.debug(`Authorization Header: ${tokenHeader}`);

  if (!tokenHeader) {
    logger.error("No token provided");
    return res.status(401).send("Access denied. No token provided.");
  }

  const token = tokenHeader.split(" ")[1];
  logger.debug(`Extracted Token: ${token}`);

  try {
    const decoded = jwt.verify(token, secretKey);

    req.user = { ...decoded, walletAddress: decoded.walletAddress };
    logger.debug(`Token validated for user: ${decoded.username}`);
    next();
  } catch (error) {
    logger.error(`Token validation error: ${error.message}`);
    res.status(400).send("Invalid token.");
  }
}

module.exports = validateJWT;
