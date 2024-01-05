// server/utilities/requestAccess.js

const logger = require("../utilities/logger");
const { getUserWalletAddress } = require("../utilities/extractWalletAddress");
const { getConnection } = require("../utilities/dbConnector");
const { requestBlockchainAccess } = require("../utilities/smartContractUtils");
const { connectToHeap } = require("../utilities/heapConnect");

async function requestAccess(documentId, requester) {
  let connection;
  try {
    connection = await getConnection("user1");

    const duplicateCheck = await checkDuplicates(
      connection,
      documentId,
      requester
    );
    if (duplicateCheck === "No duplicates") {
      const userWalletAddress = await getUserWalletAddress(requester);
      const transactionHash = await requestBlockchainAccess(
        documentId,
        userWalletAddress
      );

      logger.info(
        `requestAccess.js Submitted blockchain access request in transaction ${transactionHash}`
      );

      if (transactionHash) {
        const requestTime = Math.floor(Date.now() / 1000);
        await logRequestDB(
          connection,
          documentId,
          requester,
          requestTime,
          transactionHash
        );
      }
      return "Request submitted";
    } else {
      return duplicateCheck;
    }
  } catch (error) {
    logger.error(error);
    throw error;
  } finally {
    if (connection) await connection.close();
  }
}

// SEPARATE DB LOGIC

async function checkDuplicates(connection, documentId, requester) {
  const heapDetails = await connectToHeap(documentId);
  const docCheckQuery = heapDetails.docCheckQuery;

  logger.debug(`docCheckQuery: ${docCheckQuery}`);

  // execute document existance check
  const docExistsResult = await connection.execute(docCheckQuery, [documentId]);

  // check if document exists in heap
  // check for actual document data (not ID)
  if (docExistsResult.rows[0].COUNT === 0) {
    console.log("Document data not found");
    return "Document data not found";
  } else {
    // check if a request already exists
    const existingRequestCheck = `SELECT COUNT(*) AS count FROM ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} WHERE DOC_ID = :documentId AND TARGET_USER = :requester AND STATUS = 'requested'`;
    const existingRequestResult = await connection.execute(existingRequestCheck, {
      documentId: documentId,
      requester: requester
    });

    if (existingRequestResult.rows[0].COUNT > 0) {
      logger.info(
        `Request already exists for Document ID: ${documentId} by User: ${requester}`
      );
      return "Request already exists";
    }
  }

  return "No duplicates";
}

async function logRequestDB(
  connection,
  documentId,
  requester,
  requestTime,
  transactionHash
) {
  try {
    const requestQuery = `INSERT INTO ${process.env.DB_USER1}.${process.env.DB_TABLE_SHARED_DOCS} (DOC_ID, TARGET_USER, REQ_TS, REQ_TX_HASH, STATUS) VALUES (:documentId, :requester, :requestTime, :transactionHash, 'requested')`;

    logger.debug(`Document request logging query: ${requestQuery}`);

    logger.debug(`DOUBLE CHECK in requestAccess: document ID: ${documentId}, target user: ${requester}`);

    await connection.execute(requestQuery, [
      documentId,
      requester,
      requestTime,
      transactionHash,
    ]);
    logger.debug(
      `Document ${documentId} has recently been requested by ${requester}`
    );

    return await connection.commit();
  } catch (error) {
    logger.error("Error logging request: " + error.message);
    return "Error logging request";
  }
}

module.exports = { requestAccess };
