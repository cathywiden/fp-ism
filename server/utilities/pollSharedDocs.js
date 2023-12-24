// server/utilities/pollSharedDocs.js

const logger = require("./logger");
const { getConnection } = require("./dbConnector");
require("dotenv").config({ path: "../.env" });

const POLLING_INTERVAL = 30000; // 5 minutes

async function checkSharedDocs() {
  let connection;

  try {
    // always using user2 credentials since SHARED_DOC is user2's table!
    connection = await getConnection("user2");

    const result = await connection.execute(`
      SELECT document_id 
      FROM ${process.env.DB_USER2}.SHARED_DOCS
    `);

    logger.debug(result.rows);

    // extract document_ids
    const documentIds = result.rows.map((row) => row.DOCUMENT_ID.toString()); // Oracle returns document_ids as objects, therefore the toString conversion

    // display available documents
    // display available documents
    if (documentIds.length > 0) {
      const documentIdsStr = documentIds.join(", ");
      logger.info(`The following documents are available: ${documentIdsStr}`);
    } else {
      logger.info("There are no documents currently available.");
    }
  } catch (error) {
    logger.error(`Database error: ${error.message}, Stack: ${error.stack}`);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = { checkSharedDocs, POLLING_INTERVAL };
