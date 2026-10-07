import type { QueryRunner } from "typeorm";
import { CreateAuthTables1780768800000 } from "./1780768800000-CreateAuthTables.js";

describe("CreateAuthTables1780768800000", () => {
  const queryRunner = {
    query: vi.fn().mockResolvedValue(undefined),
  } as unknown as QueryRunner;

  beforeEach(() => {
    queryRunner.query = vi.fn().mockResolvedValue(undefined);
  });

  it("creates normalized users and hashed refresh-session storage", async () => {
    await new CreateAuthTables1780768800000().up(queryRunner);

    const statements = vi
      .mocked(queryRunner.query)
      .mock.calls.map(([sql]) => sql);
    const sql = statements.join("\n");

    expect(sql).toContain('CREATE TABLE "users"');
    expect(sql).toContain('CONSTRAINT "uq_users_username" UNIQUE ("username")');
    expect(sql).toContain('CHECK ("username" = lower("username"))');
    expect(sql).toContain("CHECK (\"username\" ~ '^[a-z0-9_]+$')");
    expect(sql).toContain('CREATE TABLE "refresh_sessions"');
    expect(sql).toContain('"token_hash" char(64) NOT NULL');
    expect(sql).not.toContain('"refresh_token"');
    expect(sql).toContain("ON DELETE CASCADE");
  });

  it("drops dependent refresh sessions before users", async () => {
    await new CreateAuthTables1780768800000().down(queryRunner);

    const statements = vi
      .mocked(queryRunner.query)
      .mock.calls.map(([sql]) => sql);
    expect(statements).toEqual([
      'DROP TABLE "refresh_sessions"',
      'DROP TABLE "users"',
    ]);
  });
});
