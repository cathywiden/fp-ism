// server/controllers/revokeAccessController.js

const logger = require("../utilities/logger");
const { revokeAccess } = require("../access/revokeAccess");

async function revokeDocumentAccess(req, res) {
    const { documentId, reason } = req.body;

    if (!req.user.role.includes("Sharer, Auditor")) {
      return res
        .status(403)
        .json({ error: "Unauthorized: Only user1 can revoke access." });
    }

    logger.debug(
      `Revoke access endpoint called with documentId: ${documentId}, reason: ${reason}`
    );

    try {
      await revokeAccess(documentId, reason);
      res.status(200).json({ message: "Access revoked successfully" });
    } catch (error) {
      logger.error(`Error in revoke-access endpoint: ${error.message}`);
      res.status(500).json({ error: "Error revoking access" });
    }
}

module.exports = { revokeDocumentAccess };
