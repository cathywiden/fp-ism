// server/controllers/grantAccessController.js

const logger = require("../utilities/logger");
const { grantAccess } = require("../access/grantAccess");

async function grantDocumentAccess(req, res) {
  logger.debug(`Request headers in /grant: ${JSON.stringify(req.headers)}`);

  if (req.user.role.includes("Sharer, Auditor")) {
    try {
      logger.debug(`Grantor: ${req.user}`);
      logger.debug(`Grantor user role: ${req.user.role}`);

      const { documentId, targetUser, documentHash, expiryInSeconds } =
        req.body;

      await grantAccess(documentId, targetUser, documentHash, expiryInSeconds);
      res.status(200).json({ message: "Document shared successfully" });
    } catch (error) {
      logger.error(`Error in grant endpoint: ${error}`);
      if (error.code === "CALL_EXCEPTION") {
        res.status(500).json({
          error: "Blockchain transaction failed",
          details: error.message,
        });
      } else {
        logger.error(`Error in grant endpoint: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    }
  } else {
    res
      .status(403)
      .json({ error: "Unauthorized: Only user1 can grant access." });
  }
}

module.exports = { grantDocumentAccess };
