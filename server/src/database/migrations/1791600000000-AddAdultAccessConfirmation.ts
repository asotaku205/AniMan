import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdultAccessConfirmation1791600000000 implements MigrationInterface {
  name = "AddAdultAccessConfirmation1791600000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "adult_access_confirmed_at" timestamptz
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "adult_access_confirmed_at"
    `);
  }
}
