// server/access/tokenValidation.js

const jwt = require("jsonwebtoken");
const { checkAccess } = require("../utilities/smartContractUtils");
const { getUserWalletAddress } = require("../utilities/extractWalletAddress");

async function validateToken(req, res, next) {

  // parse JWT from the auth header
  const tokenHeader = req.headers["authorization"];
  console.log("Token Header:", tokenHeader);  

  if (tokenHeader) {

    try {
      const token = tokenHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

      // set req.user
      req.user = decoded;
      console.log("Decoded Token:", decoded);  

      // skip checkAccess for api routes (which checks document access tokens!) 
      if (req.originalUrl === "/request-access" || req.originalUrl === "/grant-access" || req.originalUrl === "/revoke-access" || req.originalUrl === "/deny-access") {
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

  // skip checkAccess for API routes
  if (req.originalUrl === "/request-access" || req.originalUrl === "/grant-access" || req.originalUrl === "/revoke-access" || req.originalUrl === "/deny-access") {
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
