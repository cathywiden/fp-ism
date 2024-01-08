const jwt = require('jsonwebtoken');
const { checkAccess } = require("../utilities/smartContractUtils");
const { getUserWalletAddress } = require("../utilities/extractWalletAddress");

async function validateToken(req, res, next) {
  const tokenHeader = req.headers['authorization'];

  if (tokenHeader) {
    // JWT validation
    try {
      const token = tokenHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      req.user = decoded;

      console.log(decoded);

      // Check access with wallet address from token
      const hasAccess = await checkAccess(req.user.walletAddress, req.params.id);
      if (!hasAccess) {
        return res.status(403).send("Access forbidden");
      }

      return next();
    } catch (error) {
      return res.status(400).send("Invalid token.");
    }
  }

  // Fallback for direct backend queries without JWT
  const userAddress = await getUserWalletAddress(process.env.DB_USER2);
  if (!userAddress) {
    return res.status(500).send("Error fetching user's wallet address");
  }

  const valid = await checkAccess(userAddress, req.params.id);
  if (!valid) {
    return res.status(403).send("Access forbidden");
  }

  next();
}

module.exports = { validateToken };


/* // server/access/tokenValidation.js

const { checkAccess } = require("../utilities/smartContractUtils");
const { getUserWalletAddress } = require("../utilities/extractWalletAddress");
require("dotenv").config({ path: "../.env" });

async function validateToken(req, res, next) {
  // extract user2's wallet address 
  const userAddress = await getUserWalletAddress(process.env.DB_USER2);

  if (!userAddress) {
    return res.status(500).send("Error fetching user's wallet address");
  }

  const documentId = req.params.id;
  const valid = await checkAccess(userAddress, documentId);

  if (!valid) {
    return res.status(403).send("Access forbidden");
  }

  next();
}

async function isTokenValid(userAddress, documentId) {
  return await checkAccess(userAddress, documentId);
}

module.exports = { validateToken, isTokenValid };
 */