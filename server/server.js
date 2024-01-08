//  server/server.js

require("dotenv").config({ path: "../.env" });
const { getDocumentById } = require("../server/utilities/dbUtils");
const { initialize, close } = require("../server/utilities/dbConnector");
const { validateToken } = require("./access/tokenValidation");
const logger = require("../server/utilities/logger");
const { grantAccess } = require("./access/grantAccess");
const { denyRequest } = require("./access/denyRequest");
const { revokeAccess } = require("./access/revokeAccess");
const { requestAccess } = require("./access/requestAccess");
const {
  isTamperedWithInDB,
  TAMPER_POLLING_INTERVAL,
} = require("./utilities/logTampering");
const {
  checkSharedDocs,
  POLLING_INTERVAL,
} = require("./utilities/pollSharedDocs");
const { determineUserRole } = require("./middlewares/roleDetermination");
const validateJWT = require("./middlewares/validateJWT");
const { generateToken } = require("./utilities/JWTGenerator");

const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(cors());
app.set("json spaces", 2); // pretty-format logs

// hardcoded credentials for MVP
const USERS = {
  user1: { username: "user1", password: "user1", role: "Sharer, Auditor", walletAddress: process.env.WALLET1 },
  user2: { username: "user2", password: "user2", role: "Receiver", walletAddress: process.env.WALLET2 }
};

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = USERS[username];

  if (user && user.password === password) {
   
    const token = generateToken({ username: user.username, role: user.role, walletAddress: user.walletAddress });

    res.json({ token });
  } else {
    res.status(401).send("Invalid credentials");
  }
});





// fetch user roles from db
app.get("/get-user-role", validateJWT, determineUserRole, (req, res) => {
  res.json({ role: req.user.role });
});

// protected route for jwt
app.get('/protected-route', validateJWT, determineUserRole, (req, res) => {

  if (req.user.role === 'Sharer, Auditor') {
    // operations specific to Sharer and Auditor
    res.json({ message: 'Accessing Sharer and Auditor specific data' });
  } else if (req.user.role === 'Receiver') {
    // perform operations specific to Receiver
    res.json({ message: 'Accessing Receiver specific data' });
  } else {
    res.status(403).send('Access denied. Unauthorized role.');
  }
});

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

app.post("/request-access", async (req, res) => {
  const { documentId, requester } = req.body;

  logger.debug(`Received documentId in endpoint: ${documentId}`);
  logger.debug(`Requester: ${requester}`);
  try {
    await requestAccess(documentId, requester);

    res.status(200).send("Request submitted");
  } catch (error) {
    logger.error(`Error in route handler: ${error.message}`);
    res.status(500).send("Error submitting request");
  }
});

app.post("/deny-access", async (req, res) => {
  const { documentId, userAddress, reason } = req.body;
  try {
    await denyRequest(documentId, userAddress, reason);
    res.status(200).send("Access denied");
  } catch (error) {
    logger.error(`Error in /deny-access endpoint: ${error.message}`);
    res.status(500).send("Error denying access");
  }
});

// grant access
app.post("/grant-access", async (req, res) => {
  try {
    const requestData = req.body;
    await grantRequest(requestData);
    res.status(200).send("Access granted successfully");
  } catch (error) {
    logger.error(`Error in /grant-access endpoint: ${error.message}`);
    res.status(500).send("Error granting access");
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
      setInterval(isTamperedWithInDB, TAMPER_POLLING_INTERVAL);
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
