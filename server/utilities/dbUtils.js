// server/utilities/dbUtils.js

const logger = require("./logger");
const { getConnection } = require("./dbConnector");
require("dotenv").config({ path: "../.env" });

async function getDocumentById(document_id, userType) {
  let connection;
  try {
    logger.debug(
      `getDocumentById called with document_id: ${document_id}, userType: ${userType}`
    );
    connection = await getConnection(userType);
    const query = `SELECT DBMS_LOB.SUBSTR(XML, 500, 1) AS XML_SNIPPET FROM ${process.env.DB_TABLE2} WHERE document_id = :id`;
    logger.debug(`Executing query: ${query}`);
    const result = await connection.execute(query, [document_id]);

    logger.info("Query result:", result);
    return result.rows.length > 0 ? result.rows[0].XML_SNIPPET : null;
  } catch (error) {
    logger.error(`Error in getDocumentById: ${error.message}`);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = { getDocumentById };
