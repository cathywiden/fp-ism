//  server/server.js

require("dotenv").config({ path: "../.env" });

const { getDocumentById } = require("../server/utilities/dbUtils");

const { initialize, close } = require("../server/utilities/dbConnector");

const { validateToken } = require("./access/tokenValidation");

const logger = require("../server/utilities/logger");
const { grantAccess } = require("./access/grantAccess");

const { revokeAccess } = require("./access/revokeAccess");

const { requestAccess } = require("./access/requestAccess");

const {
  checkSharedDocs,
  POLLING_INTERVAL,
} = require("./utilities/pollSharedDocs");

const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(cors());
app.set("json spaces", 2); // pretty-format logs!

// endpoint to query a document by id and display the XML
app.get("/document/:id", validateToken, async (req, res) => {
  try {
    const document_id = req.params.id;
    const userType = "user2";
    logger.debug(
      `Fetching document with ID: ${document_id} for userType: ${userType}`
    );
    const document = await getDocumentById(document_id, userType);

    if (!document || document.length === 0) {
      logger.info("No document found or empty document");
      return res.status(404).send("The specified document ID does not exist!");
    }
    res.json(document);
  } catch (error) {
    logger.error(`Error in route handler: ${error.message}`);
    res.status(500).send("Error fetching document");
  }
});

app.post("/proactive-share", async (req, res) => {
  logger.info(`Received request: ${JSON.stringify(req.body)}`);
  try {
    const { documentId, targetUser, documentHash, expiryInSeconds } = req.body;
    logger.info(
      `Extracted Request Data: documentId=${documentId}, targetUser=${targetUser}, documentHash=${documentHash}, expiryInSeconds=${expiryInSeconds}`
    );
    await grantAccess(
      documentId,
      targetUser,
      documentHash,
      expiryInSeconds,
      true
    );
    res.status(200).send("Document shared successfully");
  } catch (error) {
    logger.error(`Error in proactive-share endpoint: ${error}`);
    res.status(500).send("Error in document sharing");
  }
});

// endpoint to revoke access
app.post("/revoke-access", async (req, res) => {
  const { documentId, reason } = req.body;
  logger.debug(
    `Revoke access endpoint called with documentId: ${documentId}, reason: ${reason}`
  );

  try {
    await revokeAccess(documentId, reason);
    res.status(200).send("Access revoked");
  } catch (error) {
    logger.error(`Error in revoke-access endpoint: ${error.message}`);
    res.status(500).send("Error revoking access");
  }
});

// endpoint to request access
/* app.post("/request-access", async (req, res) => {
  const { documentId, requester } = req.body;

  try {
    const result = await requestAccess(documentId, requester);

    if (result === "Request submitted") {
      res.status(200).send(result);
    } else {
      res.status(400).send(result);
    }
  } catch (error) {
    logger.error(`Error in route handler: ${error.message}`);
    res.status(500).send("Error submitting request");
  }
}); */

app.post("/request-access", async (req, res) => {
  const { documentId, requester } = req.body;

  console.log("Received documentId in endpoint:", documentId); 
  console.log("Requester", requester);
  try {
      await requestAccess(documentId, requester);
      
      res.status(200).send("Request submitted");
  } catch (error) {
      logger.error(`Error in route handler: ${error.message}`);
      res.status(500).send("Error submitting request");
  }
});


// grant access endpoint
app.post("/grant-access", async (req, res) => {
  const { documentId, targetUser } = req.body;
  try {
    await grantAccess(documentId, targetUser);
    res.status(200).send("Access granted");
  } catch (error) {
    res.status(500).send("Error granting access");
  }
});

// deny access endpoint
app.post("/deny-access", async (req, res) => {
  const { documentId, reason } = req.body;
  try {
    await denyDocumentAccess(documentId, reason);
    res.status(200).send("Access denied");
  } catch (error) {
    res.status(500).send("Error denying access");
  }
});

async function startServer() {
  try {
    await initialize();
    logger.info("Database pool initialized successfully.");
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      // start polling
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
