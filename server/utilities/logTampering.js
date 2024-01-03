const { logTampering } = require("./smartContractUtils");
const { getConnection } = require("./dbConnector");
const logger = require("./logger");
require("dotenv").config({ path: "../.env" });

const TAMPER_POLLING_INTERVAL = 600000; // 10 minutes

// checks for tampering in the database
async function isTamperedWithInDB() {
  let connection;
  try {
    connection = await getConnection("user2");
    const query = `SELECT DOC_ID, CHECKSUM, TAMPERED_HASH, TAMPER_TS 
                       FROM ${process.env.DB_TABLE_CHECKSUM} 
                       WHERE TAMPERED_HASH IS NOT NULL AND LOG_TX_HASH IS NULL`;
                       // select entries that have a tampered hash value but have not been sent to the chain yet

    const result = await connection.execute(query);
    for (const row of result.rows) {
      const transaction = await logTampering(
        row.DOC_ID,
        row.CHECKSUM,
        row.TAMPERED_HASH
      );

      if (transaction) {
        logger.debug(
            `Updating database for document ID ${row.DOC_ID}. Transaction hash: ${transaction}`
          );
        const updateQuery = `UPDATE ${process.env.DB_TABLE_CHECKSUM} 
                                     SET LOG_TX_HASH = :txHash
                                     WHERE DOC_ID = :docId`;
        await connection.execute(updateQuery, {
          txHash: transaction,
          docId: row.DOC_ID,
        });
        logger.info(
          `Tampering with document ID ${row.DOC_ID} has been logged on-chain. Transaction hash: ${transaction}`
        );
      }
    }
    await connection.commit();
  } catch (error) {
    logger.error(`Error in isTamperedWithInDB: ${error.message}`);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = {
  isTamperedWithInDB,
  TAMPER_POLLING_INTERVAL,
};
