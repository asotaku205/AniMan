import "dotenv/config";
import { DataSource } from "typeorm";
import { RefreshSession } from "../auth/refresh-session.entity.js";
import { User } from "../users/user.entity.js";
import { CreateAuthTables1780768800000 } from "./migrations/1780768800000-CreateAuthTables.js";
import { AddUserRoles1791400000000 } from "./migrations/1791400000000-AddUserRoles.js";
import { AddUserStatusAndMultipleAdmins1793228985000 } from "./migrations/1793228985000-AddUserStatusAndMultipleAdmins.js";
import { CreateWorkSubmissions1793232564000 } from "./migrations/1793232564000-CreateWorkSubmissions.js";
import { CreateAuditLogs1793234022000 } from "./migrations/1793234022000-CreateAuditLogs.js";
import { AuditLog } from "../audit/audit-log.entity.js";
import { WorkSubmission } from "../works/work-submission.entity.js";

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
  entities: [User, RefreshSession, WorkSubmission, AuditLog],
  migrations: [
    CreateAuthTables1780768800000,
    AddUserRoles1791400000000,
    AddUserStatusAndMultipleAdmins1793228985000,
    CreateWorkSubmissions1793232564000,
    CreateAuditLogs1793234022000,
  ],
  synchronize: false,
});
