// server/access/tokenValidation.js

const jwt = require("jsonwebtoken");
const { checkAccess } = require("../utilities/smartContractUtils");
const { getUserWalletAddress } = require("../utilities/extractWalletAddress");

async function validateToken(req, res, next) {
  const tokenHeader = req.headers["authorization"];

  if (tokenHeader) {
    // JWT validation
    try {
      const token = tokenHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      req.user = decoded;

      console.log(decoded);

      // skip checkAccess for /request-access route
      if (req.originalUrl === "/request-access") {
        return next();
      }

      // check access with wallet address from token
      const hasAccess = await checkAccess(
        req.user.walletAddress,
        req.params.id
      );
      if (!hasAccess) {
        return res.status(403).send("Access forbidden");
      }

      return next();
    } catch (error) {
      return res.status(400).send("Invalid token.");
    }
  }

  // fallback for direct backend queries without JWT
  // skip checkAccess for /request-access route
  if (req.originalUrl === "/request-access") {
    return next();
  }

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

async function isTokenValid(userAddress, documentId) {
  return await checkAccess(userAddress, documentId);
}

module.exports = { validateToken, isTokenValid };
