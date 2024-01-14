// server/utilities/dbConnector.js

const oracledb = require("oracledb");
require("dotenv").config({ path: "../.env" });

// database connection details
const connectString = `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pools = {};

async function initialize() {
  pools["user1"] = await oracledb.createPool({
    user: process.env.DB_USER1,
    password: process.env.DB_PASS1,
    connectString: connectString,
    poolMax: 10,
    poolMin: 2,
    poolIncrement: 2,
    poolTimeout: 60,
    queueRequests: true,
    queueTimeout: 60000,
  });

  pools["user2"] = await oracledb.createPool({
    user: process.env.DB_USER2,
    password: process.env.DB_PASS2,
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
  await Promise.all(Object.values(pools).map((pool) => pool.close()));
}

async function getConnection(userType) {
  return await pools[userType].getConnection();
}

module.exports = { initialize, close, getConnection };
