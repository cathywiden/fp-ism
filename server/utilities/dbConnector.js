// server/utilities/dbConnector.js

const oracledb = require("oracledb");
require("dotenv").config({ path: "../.env" });

// database connection details
const connectString = `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

// initialize Oracle client: return query results as JS objects with column names as keys
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool;

async function initialize() {
  pool = await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    connectString: connectString,
    poolMax: 10,
    poolMin: 2,
    poolIncrement: 2,
    poolTimeout: 60,
    queueRequests: true,
    queueTimeout: 60000,
  });
}

async function close() {
  await oracledb.getPool().close();
}

async function getConnection() {
  return await pool.getConnection();
}

module.exports = { initialize, close, getConnection };

