// server/utilities/heapConnect.js

const { getConnection } = require("./dbConnector");
const logger = require("./logger");

async function connectToHeap(documentId) {
  let connection;

  try {
    // get connection as user1
    connection = await getConnection("user1");

    // heap ID lookup query
    const heapIdQuery = `SELECT HEAP_ID FROM T_DOCSTORE WHERE DOC_ID = :documentId`;

    // execute heap ID lookup
    const heapIdResult = await connection.execute(heapIdQuery, [documentId]);

    // throw error if no result
    if (heapIdResult.rows.length === 0) {
      throw new Error("Document not found in T_DOCSTORE");
    }

    // get heapId from rows
    const heapId = heapIdResult.rows[0].HEAP_ID;

    // construct heap table name
    const heapTableName = `"t_heap_${heapId}"`;

    // query to check document exists
    const docCheckQuery = `SELECT COUNT(*) AS COUNT FROM ${heapTableName} WHERE DOCUMENT_ID = :documentId`;

    // return connection and heapId
    return {
      connection,
      docCheckQuery,
    };
  } catch (error) {
    // log and throw any errors
    logger.error("connectToHeap error: " + error.message);
    throw error;
  }
}

module.exports = {
  connectToHeap,
};
