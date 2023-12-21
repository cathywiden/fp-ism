//  server/server.js

require("dotenv").config({ path: "../.env" });

const { getDocumentById } = require('../server/utilities/dbUtils');

const {
  initialize,
  close,
} = require("../server/utilities/dbConnector");

const logger = require("../server/utilities/logger");

const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

app.set("json spaces", 2); // pretty-format logs!
app.use(express.json());

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

async function startServer() {
  try {
      await initialize();
          logger.info("Database pool initialized successfully.");
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
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
