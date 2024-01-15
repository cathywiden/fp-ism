//  server/server.js

require("dotenv").config({ path: "../.env" });

const express = require("express");
const app = express();
const cors = require("cors");

// routes
const authRoutes = require("./routes/authRoutes");
const userRoleRoutes = require("./routes/userRoleRoutes");
const documentRoutes = require("./routes/documentRoutes"); 
const grantAccessRoutes = require("./routes/grantAccessRoutes");

// utilities
const { initialize, close } = require("../server/utilities/dbConnector");
const {
  getAllSharedDocs,
  expireDocuments,
  EXPIRE_DOCUMENTS_INTERVAL,
} = require("../server/utilities/dbUtils");
const logger = require("../server/utilities/logger");

// access control
const { validateToken } = require("./access/tokenValidation");
const validateJWT = require("./middlewares/validateJWT");
const { determineUserRole } = require("./middlewares/roleDetermination");

// access functions
const { grantAccess } = require("./access/grantAccess");
const { denyRequest } = require("./access/denyRequest");
const { revokeAccess } = require("./access/revokeAccess");
const { requestAccess } = require("./access/requestAccess");

// document tampering
const {
  isTamperedWithInDB,
  TAMPER_POLLING_INTERVAL,
} = require("./utilities/logTampering");

// polling shared documents
const {
  checkSharedDocs,
  POLLING_INTERVAL,
} = require("./utilities/pollSharedDocs");

const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.set("json spaces", 2); // pretty-format logs

app.use("/", authRoutes);
app.use("/get-user-role", validateJWT, determineUserRole, userRoleRoutes); 
app.use("/document", documentRoutes); 
app.use("/grant-access", grantAccessRoutes);

// endpoint to revoke access
app.post(
  "/revoke-access",
  validateToken,
  determineUserRole,
  async (req, res) => {
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
);

app.post(
  "/request-access",
  validateToken,
  determineUserRole,
  async (req, res) => {
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
);

app.post("/deny-access", validateToken, determineUserRole, async (req, res) => {
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
});

app.get("/shared-docs", validateJWT, async (req, res) => {
  try {
    const userType = req.user.role.includes("Receiver") ? "user2" : "user1";
    let sharedDocs = await getAllSharedDocs(userType);
    const currentTime = Math.floor(Date.now() / 1000);

    if (userType === "user2") {
      // do not display expired documents for user2
      sharedDocs = sharedDocs.filter((doc) => doc.TOKEN_EXP_TS > currentTime);
    } else {
      // for user1:
      // mark documents as expired based on timestamp
      sharedDocs = sharedDocs.map((doc) => {
        if (doc.STATUS === "granted" && doc.TOKEN_EXP_TS < currentTime) {
          return { ...doc, STATUS: "expired" };
        }
        return doc;
      });
    }

    res.json(sharedDocs);
    console.log(sharedDocs);
  } catch (error) {
    console.error("Error in /shared-docs endpoint:", error);
    res.status(500).send("Error fetching shared documents");
  }
});

async function startServer() {
  try {
    await initialize();
    logger.info("Database pool initialized successfully.");
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      setInterval(checkSharedDocs, POLLING_INTERVAL);
      setInterval(isTamperedWithInDB, TAMPER_POLLING_INTERVAL);
      setInterval(expireDocuments, EXPIRE_DOCUMENTS_INTERVAL);
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
