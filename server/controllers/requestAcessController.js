// server/controllers/requestAccessController.js

const logger = require("../utilities/logger");
const { requestAccess } = require("../access/requestAccess");

async function requestDocumentAccess(req, res) {
  const { documentId } = req.body;
  let requester;

  // frontend call with JWT: req.user is set
  if (req.user) {
    requester = req.dbUser; // dbUser set by determineUserRole.js
  } else {
    // direct backend call: use requester from req body
    requester = req.body.requester;
  }

  logger.debug(
    `Requesting access to document ID: ${documentId} for user: ${requester}`
  );

  try {
    const response = await requestAccess(documentId, requester);
    res.status(200).json({ message: response });
  } catch (error) {
    logger.error(`Error in /request-access endpoint: ${error.message}`);
    res.status(500).json({ error: "Error submitting request" });
  }
}

module.exports = { requestDocumentAccess };
