import type { QueryRunner } from "typeorm";
import { AddUserRoles1791400000000 } from "./1791400000000-AddUserRoles.js";

describe("AddUserRoles1791400000000", () => {
  const queryRunner = {
    query: vi.fn().mockResolvedValue(undefined),
  } as unknown as QueryRunner;

  beforeEach(() => {
    queryRunner.query = vi.fn().mockResolvedValue(undefined);
  });

  it("defaults existing and newly created accounts to user and allows one admin", async () => {
    await new AddUserRoles1791400000000().up(queryRunner);

    const sql = vi
      .mocked(queryRunner.query)
      .mock.calls.map(([statement]) => statement)
      .join("\n");
    expect(sql).toContain(`DEFAULT 'user'`);
    expect(sql).toContain(`CHECK ("role" IN ('user', 'admin'))`);
    expect(sql).toContain('CREATE UNIQUE INDEX "uq_users_single_admin"');
    expect(sql).toContain(`WHERE "role" = 'admin'`);
  });

  it("removes the admin constraint and role column on rollback", async () => {
    await new AddUserRoles1791400000000().down(queryRunner);

    expect(vi.mocked(queryRunner.query).mock.calls.map(([sql]) => sql)).toEqual(
      [
        'DROP INDEX "uq_users_single_admin"',
        'ALTER TABLE "users" DROP CONSTRAINT "ck_users_role", DROP COLUMN "role"',
      ],
    );
  });
});
