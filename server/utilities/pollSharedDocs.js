// server/utilities/pollSharedDocs.js

require("dotenv").config({ path: "../.env" });
const logger = require("./logger");
const { getConnection } = require("./dbConnector");
const { isTokenValid } = require("../access/tokenValidation");
const { getUserWalletAddress } = require("./extractWalletAddress");


// const POLLING_INTERVAL = 300000; // 5 minutes
const POLLING_INTERVAL = 1000000; // for test only

async function checkSharedDocs() {
  let connection;
  try {
    // always using user2 credentials since SHARED_DOC is user2's table!
    connection = await getConnection("user2");
    const result = await connection.execute(
      `SELECT doc_id FROM ${process.env.DB_TABLE_SHARED_DOCS}`
    );
    const validDocs = [];

    // get wallet address for user2
    // would be better dynamically?
    const userWalletAddress = await getUserWalletAddress(process.env.DB_USER2);

    logger.info(userWalletAddress);

    for (const row of result.rows) {
      // Oracle returns document_ids as objects, therefore the toString conversion
      const documentId = row.DOC_ID.toString();
      const valid = await isTokenValid(userWalletAddress, documentId);
      if (valid) {
        validDocs.push(documentId);
      }
    }

    logger.info(`Valid document(s): ${validDocs.join(", ")}`);
  } catch (error) {
    logger.error(`Database error: ${error.message}`);
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { checkSharedDocs, POLLING_INTERVAL };
