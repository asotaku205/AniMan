import "dotenv/config";
import { DataSource } from "typeorm";
import { RefreshSession } from "../auth/refresh-session.entity.js";
import { User } from "../users/user.entity.js";
import { CreateAuthTables1780768800000 } from "./migrations/1780768800000-CreateAuthTables.js";

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export default new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: requiredEnvironmentVariable("DATABASE_USERNAME"),
  password: requiredEnvironmentVariable("DATABASE_PASSWORD"),
  database: "animan",
  entities: [User, RefreshSession],
  migrations: [CreateAuthTables1780768800000],
  synchronize: false,
});
