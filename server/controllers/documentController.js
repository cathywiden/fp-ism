const logger = require("../utilities/logger");
const { getDocumentById } = require("../utilities/dbUtils");
const checkDocumentTampering = require("../utilities/checkDocumentTampering");

async function getDocument(req, res) {
  try {
    const documentId = req.params.id;
    const userType = "user2";
    logger.debug(
      `Fetching document with ID: ${documentId} for userType: ${userType}`
    );
    const document = await getDocumentById(documentId, userType);

    if (!document || document.length === 0) {
      logger.info("No document found or empty document");
      return res.status(404).send("The specified document ID does not exist!");
    }

    // check for tampering
    const isTampered = await checkDocumentTampering(documentId);
    logger.debug(`isTampered: ${isTampered}`);

    // single response with document and tampering status
    res.json({ document, isTampered });
  } catch (error) {
    logger.error(`Error in route handler: ${error.message}`);
    res.status(500).send("Error fetching document");
  }
}

module.exports = { getDocument };
