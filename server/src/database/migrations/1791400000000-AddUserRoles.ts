import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserRoles1791400000000 implements MigrationInterface {
  name = "AddUserRoles1791400000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "role" text NOT NULL DEFAULT 'user',
      ADD CONSTRAINT "ck_users_role"
        CHECK ("role" IN ('user', 'admin'))
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_users_single_admin"
      ON "users" ("role")
      WHERE "role" = 'admin'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "uq_users_single_admin"');
    await queryRunner.query(
      'ALTER TABLE "users" DROP CONSTRAINT "ck_users_role", DROP COLUMN "role"',
    );
  }
}
