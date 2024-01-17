require("dotenv").config({ path: "../../.env" });
const logger = require("./logger");
const jwt = require("jsonwebtoken");

function generateToken(user) {
  logger.info(`Generating JWT for user:, ${user}`);

  const payload = {
    username: user.username,
    role: user.role,
    walletAddress: user.walletAddress,
  };

  const secretKey = process.env.JWT_SECRET_KEY;
  logger.debug(`Secret key at token generation: ${secretKey}`);

  const options = { expiresIn: "20d" };
  return jwt.sign(payload, secretKey, options);
}

module.exports = { generateToken };
