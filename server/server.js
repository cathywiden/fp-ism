require("dotenv").config({ path: "../.env" });

const express = require("express");
const app = express();
const cors = require("cors");
const eventEmitter = require("./utilities/eventEmitter");
const { setupWebhookListener } = require("./utilities/webhookHandler");
const websocket = require("ws");
const wss = new websocket.Server({ port: 3001 });

const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.set("json spaces", 2); // pretty-format logs

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
const { startEventCapture } = require("./access/captureDocAccessAttempt");

// document tampering
const {
  isTamperedWithInDB,
  TAMPER_POLLING_INTERVAL,
} = require("./utilities/logTampering");

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
const notificationRoutes = require("./routes/notificationRoutes");

// endpoints
app.use("/", authRoutes);
app.use("/get-user-role", validateJWT, determineUserRole, userRoleRoutes);
app.use("/document", documentRoutes);
app.use("/grant-access", grantAccessRoutes);
app.use("/revoke-access", revokeAccessRoutes);
app.use("/request-access", requestAccessRoutes);
app.use("/deny-access", denyAccessRoutes);
app.use("/shared-docs", sharedDocsRoutes);
app.use("/renew-access", validateJWT, determineUserRole, renewAccessRoutes);
app.use("/notifications", notificationRoutes);

wss.on("connection", function connection(socket) {
  socket.on("message", function message(data) {
    // notify frontend
    socket.send(JSON.stringify(data));
  });
});

eventEmitter.on("accessChanged", (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === websocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
});

async function startServer() {
  try {
    await initialize();
    logger.info("Database pool initialized successfully.");
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      setInterval(isTamperedWithInDB, TAMPER_POLLING_INTERVAL);
      setInterval(expireDocuments, EXPIRE_DOCUMENTS_INTERVAL);
      setupWebhookListener();
      startEventCapture();
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
