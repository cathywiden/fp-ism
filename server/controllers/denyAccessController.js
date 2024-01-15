// server/controllers/denyAccessController.js

const logger = require("../utilities/logger");
const { denyRequest } = require("../access/denyRequest");

async function denyDocumentAccess(req, res) {
  if (!req.user.role.includes("Sharer, Auditor")) {
    return res
      .status(403)
      .json({ error: "Unauthorized: Only user1 can deny access." });
  }

  const { documentId, targetUser, reason } = req.body;
  logger.debug(
    `Deny access endpoint called with documentId: ${documentId}, targetUser: ${targetUser}, reason: ${reason}`
  );

  try {
    await denyRequest(documentId, targetUser, reason);
    res.status(200).json({ message: "Access denied successfully" });
  } catch (error) {
    logger.error(`Error in deny-access endpoint: ${error.message}`);
    res.status(500).json({ error: "Error denying access" });
  }
}

module.exports = { denyDocumentAccess };
