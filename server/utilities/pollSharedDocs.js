// server/utilities/pollSharedDocs.js

const logger = require("./logger");
const { getConnection } = require("./dbConnector");
const { isTokenValid } = require("../access/tokenValidation");
const { getUserWalletAddress } = require("../access/extractWalletAddress");
require("dotenv").config({ path: "../.env" });

const POLLING_INTERVAL = 300000; // 5 minutes

async function checkSharedDocs() {
  let connection;
  try {
    // always using user2 credentials since SHARED_DOC is user2's table!
    connection = await getConnection("user2");
    const result = await connection.execute(
      `SELECT document_id FROM ${process.env.DB_USER2}.SHARED_DOCS`
    );
    const validDocs = [];

    // get wallet address for user2
    // would be better dynamically?
    const userWalletAddress = await getUserWalletAddress("BCCONV");
    console.log(userWalletAddress);

    for (const row of result.rows) {
      // Oracle returns document_ids as objects, therefore the toString conversion
      const documentId = row.DOCUMENT_ID.toString();
      const valid = await isTokenValid(userWalletAddress, documentId);
      if (valid) {
        validDocs.push(documentId);
      }
    }

    logger.info(`Valid documents: ${validDocs.join(", ")}`);
  } catch (error) {
    logger.error(`Database error: ${error.message}`);
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { checkSharedDocs, POLLING_INTERVAL };
