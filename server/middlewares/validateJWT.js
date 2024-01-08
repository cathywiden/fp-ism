// middlewares/validateJWT.js

require("dotenv").config({ path: "../../.env" });
const jwt = require('jsonwebtoken');
const logger = require("../utilities/logger");

const secretKey = process.env.JWT_SECRET_KEY;
logger.debug(`JWT_SECRET_KEY at token validation: ${secretKey}`);

function validateJWT(req, res, next) {
  
    console.log("validateJWT middleware reached");

    console.log("Request headers:", req.headers);

    const tokenHeader = req.headers['authorization'];
    logger.debug(`Authorization Header: ${tokenHeader}`);


    if (!tokenHeader) {
        logger.error('No token provided');
        return res.status(401).send("Access denied. No token provided.");
    }

    const token = tokenHeader.split(' ')[1];
    logger.debug(`Extracted Token: ${token}`);

    try {
        console.log("validateJWT.js checkpoint2 -- are we in here?");
       
        const decoded = jwt.verify(token, secretKey);
        
        console.log("validateJWT.js checkpoint3 -- are we in here?");
        
        console.log('Decoded token:', decoded);

        req.user = { ...decoded, walletAddress: decoded.walletAddress };
        logger.debug(`Token validated for user: ${decoded.username}`);
        next();
    } catch (error) {
        logger.error(`Token validation error: ${error.message}`);
        res.status(400).send("Invalid token.");
    }
}

module.exports = validateJWT;
