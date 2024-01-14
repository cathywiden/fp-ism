// server/access/tokenValidation.js

const jwt = require("jsonwebtoken");
const { checkAccessOnChain } = require("../utilities/smartContractUtils");
const { getUserWalletAddress } = require("../utilities/extractWalletAddress");

async function validateToken(req, res, next) {
  // parse JWT from the auth header
  const tokenHeader = req.headers["authorization"];

  if (tokenHeader) {
    try {
      const token = tokenHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

      // set req.user
      req.user = decoded;
      console.log("Decoded Token:", decoded);

      // skip checkAccessOnChain for api routes (which checks document access tokens!)
      if (
        req.originalUrl === "/request-access" ||
        req.originalUrl === "/grant-access" ||
        req.originalUrl === "/revoke-access" ||
        req.originalUrl === "/deny-access"
      ) {
        return next();
      }

      // check access with wallet address from token
      const hasAccess = await checkAccessOnChain(
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

  // skip checkAccessOnChain for API routes
  if (
    req.originalUrl === "/request-access" ||
    req.originalUrl === "/grant-access" ||
    req.originalUrl === "/revoke-access" ||
    req.originalUrl === "/deny-access"
  ) {
    return next();
  }

  const userAddress = await getUserWalletAddress(process.env.DB_USER2);
  if (!userAddress) {
    return res.status(500).send("Error fetching user's wallet address");
  }

  const valid = await checkAccessOnChain(userAddress, req.params.id);
  if (!valid) {
    return res.status(403).send("Access forbidden");
  }

  next();
}

async function isTokenValid(userAddress, documentId) {
  return await checkAccessOnChain(userAddress, documentId);
}

module.exports = { validateToken, isTokenValid };
