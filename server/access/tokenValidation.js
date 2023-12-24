// server/access/tokenValidation.js

const { checkAccess } = require("../utilities/smartContractUtils");
const { getUserWalletAddress } = require("./extractWalletAddress");
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
