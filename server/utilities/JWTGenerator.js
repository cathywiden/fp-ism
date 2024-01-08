// server/utilities/JWTgenerator.js

require("dotenv").config({ path: "../../.env" });
const logger = require("./logger");
const jwt = require("jsonwebtoken");

function generateToken(user) {

  console.log('JWTGenerator.js Generating token for user:', user);


  const payload = {
    username: user.username,
    role: user.role,
    walletAddress: user.walletAddress,
  };

  /*Generating token for user: { username: 'user2', role: 'Receiver', walletAddress: undefined } */

  const secretKey = process.env.JWT_SECRET_KEY;

  logger.debug(`JWTGenerator.js Secret key at token generation: ${secretKey}`);

  const options = { expiresIn: "20d" };

  return jwt.sign(payload, secretKey, options);
}

module.exports = { generateToken };
