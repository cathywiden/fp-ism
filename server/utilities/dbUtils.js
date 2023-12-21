// server/utilities/dbUtils.js

const logger = require("./logger");
const { getConnection } = require("./dbConnector");

async function getDocumentById(document_id) {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT DBMS_LOB.SUBSTR(XML, 500, 1) AS XML_SNIPPET FROM ${process.env.DB_TABLE} WHERE document_id = :id`,
      [document_id]
    );

    return result.rows.length > 0 ? result.rows[0].XML_SNIPPET : null;
  } catch (error) {
    logger.error(`Error fetching document: ${error.message}`);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = { getDocumentById };
