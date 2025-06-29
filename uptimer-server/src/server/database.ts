import { Sequelize } from "sequelize";
import { POSTGRES_DB } from "./config";
import logger from "./logger";

export const sequelize: Sequelize = new Sequelize(POSTGRES_DB, {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    multiplesStatements: true,
  },
});


export async function databaseConnection(): Promise<void> {
try {
await sequelize.authenticate();
await sequelize.sync();
logger.info("Database connection has been established successfully.");
} 
catch (error) {
logger.error(`Database connection failed: ${error}`);
}
};