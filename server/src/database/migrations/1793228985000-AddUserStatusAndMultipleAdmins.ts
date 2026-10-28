import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserStatusAndMultipleAdmins1793228985000 implements MigrationInterface {
  name = "AddUserStatusAndMultipleAdmins1793228985000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "status" text NOT NULL DEFAULT 'active',
      ADD CONSTRAINT "ck_users_status"
        CHECK ("status" IN ('active', 'suspended'))
    `);
    // Lát 2, phương án M (nhiều admin): gỡ index chỉ cho 1 admin duy nhất.
    // Bảo vệ "admin cuối cùng" chuyển sang code trong UsersService.
    await queryRunner.query('DROP INDEX "uq_users_single_admin"');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_users_single_admin"
      ON "users" ("role")
      WHERE "role" = 'admin'
    `);
    await queryRunner.query(
      'ALTER TABLE "users" DROP CONSTRAINT "ck_users_status", DROP COLUMN "status"',
    );
  }
}
