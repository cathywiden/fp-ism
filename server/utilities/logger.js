const winston = require("winston");
const { createLogger, format, transports } = require("winston");
const { combine, json, prettyPrint } = format;

const logger = createLogger({
  level: "debug",
  format: combine(json(), prettyPrint()),
  defaultMeta: { service: "database-service" },
  transports: [
    new transports.File({ filename: "./logs/error.log", level: "error" }),
    new transports.File({ filename: "./logs/combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: combine(json(), prettyPrint()),
    })
  );
}

module.exports = logger;
