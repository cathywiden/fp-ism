//  server/server.js

require("dotenv").config({ path: "../.env" });

const { getDocumentById } = require("../server/utilities/dbUtils");

const {
  initialize,
  close,
} = require("../server/utilities/dbConnector");

const logger = require("../server/utilities/logger");
const { grantAccess } = require("./access/grantAccess"); 
/* const { revokeAccess } = require("./access/revokeAccess"); */
const { checkSharedDocs, POLLING_INTERVAL } = require("./utilities/pollSharedDocs");

const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(cors());
app.set("json spaces", 2); // pretty-format logs!

// endpoint to query a document by id and display the XML
app.get('/document/:id', async (req, res) => {
    try {

        // for curl: send in document_id converted at https://www.urlencoder.org/ because of special characters causing problem in URLs!

        const document_id = req.params.id;
        const document = await getDocumentById(document_id);
        if (document.length === 0) {
            return res.status(404).send('The specified document ID does not exist!');
        }
        res.json(document);
    } catch (error) {
        logger.error(error);
        res.status(500).send('Error fetching document');
    }
});

// endpoint to proactively share a document (without it being requested first)
app.post('/proactive-share', async (req, res) => {
    try {
        const { documentId, targetUser } = req.body;
        await grantAccess(documentId, targetUser, true); // call grantAccess with isProactive = true!
        res.status(200).send('Document shared successfully');
    } catch (error) {
        logger.error(error);
        res.status(500).send('Error in document sharing');
    }
});

/* // revoke access
app.post('/revoke-access', async (req, res) => {
  try {
      const { documentId, reason } = req.body;
      await revokeAccess(documentId, reason);
      res.status(200).send(`Access revoked for document ${documentId} with reason: ${reason}`);
  } catch (error) {
      res.status(500).send(`Error revoking access: ${error.message}`);
  }
}); */

async function startServer() {
  try {
      await initialize();
          logger.info("Database pool initialized successfully.");
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
       // Start polling
  setInterval(checkSharedDocs, POLLING_INTERVAL);
    });
  } catch (error) {
    logger.error("Error starting the server:", error);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  logger.info("Shutting down server...");
  await close();
  process.exit(0);
});

startServer();
