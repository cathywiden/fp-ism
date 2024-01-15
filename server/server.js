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
const revokeAccessRoutes = require("./routes/revokeAccessRoutes");
const requestAccessRoutes = require("./routes/requestAccessRoutes");
const denyAccessRoutes = require("./routes/denyAccessRoutes");
const sharedDocsRoutes = require("./routes/sharedDocsRoutes");
const renewAccessRoutes = require("./routes/renewAccessRoutes");

// utilities
const { initialize, close } = require("../server/utilities/dbConnector");
const {
  expireDocuments,
  EXPIRE_DOCUMENTS_INTERVAL,
} = require("../server/utilities/dbUtils");
const logger = require("../server/utilities/logger");

// access control
const validateJWT = require("./middlewares/validateJWT");
const { determineUserRole } = require("./middlewares/roleDetermination");

// document tampering
const {
  isTamperedWithInDB,
  TAMPER_POLLING_INTERVAL,
} = require("./utilities/logTampering");

const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.set("json spaces", 2); // pretty-format logs

app.use("/", authRoutes);
app.use("/get-user-role", validateJWT, determineUserRole, userRoleRoutes); 
app.use("/document", documentRoutes); 
app.use("/grant-access", grantAccessRoutes);
app.use("/revoke-access", revokeAccessRoutes);
app.use("/request-access", requestAccessRoutes);
app.use("/deny-access", denyAccessRoutes);
app.use("/shared-docs", sharedDocsRoutes);
app.use("/renew-access", validateJWT, determineUserRole, renewAccessRoutes);


async function startServer() {
  try {
    await initialize();
    logger.info("Database pool initialized successfully.");
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
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
