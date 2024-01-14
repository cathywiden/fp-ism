// server/utilities/generateJWTs.js

require("dotenv").config({ path: "../../.env" });
const { generateToken } = require("./JWTGenerator");
const logger = require("./logger");

async function generateTokens() {
  try {
    const user1Data = {
      username: "user1",
      role: process.env.USER1_ROLE,
      walletAddress: process.env.WALLET1,
    };

    const user2Data = {
      username: "user2",
      role: process.env.USER2_ROLE,
      walletAddress: process.env.WALLET2,
    };

    const tokenUser1 = generateToken(user1Data);
    const tokenUser2 = generateToken(user2Data);

    logger.info(`Token for ${user1Data.username}: ${tokenUser1}`);
    logger.info(`Token for ${user2Data.username}: ${tokenUser2}`);
  } catch (error) {
    logger.error(`Error in generating tokens: ${error.message}`);
  }
}

generateTokens();
