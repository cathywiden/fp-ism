const logger = require("../utilities/logger");
const { renewAccess } = require("../access/renewAccess");

async function renewDocumentAccess(req, res) {
  logger.debug(`Received renew request`);
  logger.debug(`Request Body: ${req.body}`);
  logger.debug(`Request headers in /renew: ${JSON.stringify(req.headers)}`);

  if (req.user.role.includes("Sharer, Auditor")) {
    try {
      logger.debug(`Renewer user role: ${req.user.role}`);
      logger.debug(`User Object: ${JSON.stringify(req.user)}`);

      const { documentId, additionalTimeInSeconds } = req.body;
      logger.debug(`Document ID from Request Body: ${documentId}`);
      logger.debug(
        `Additional Time in Seconds from Request Body: ${additionalTimeInSeconds}`
      );

      const transactionHash = await renewAccess(
        documentId,
        additionalTimeInSeconds
      );
      res.status(200).json({
        message: "Document access renewed successfully",
        transactionHash,
      });
    } catch (error) {
      logger.error(`Error in renew endpoint: ${error}`);

      if (error.code === "CALL_EXCEPTION") {
        logger.error(`Blockchain transaction failed: ${error.message}`);
        res.status(500).json({
          error: "Blockchain transaction failed",
          details: error.message,
        });
      } else {
        logger.error(`Other error in renew endpoint: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    }
  } else {
    res
      .status(403)
      .json({ error: "Unauthorized: Only user1 can renew access." });
  }
}

module.exports = { renewDocumentAccess };
