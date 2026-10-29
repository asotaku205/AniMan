import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSiteSettings1793235027000 implements MigrationInterface {
  name = "CreateSiteSettings1793235027000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "site_settings" (
        "key" text NOT NULL,
        "value" text NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_site_settings" PRIMARY KEY ("key")
      )
    `);
    // Lat 4 them hanh dong settings_changed vao rang buoc CHECK cua Lat 3.
    // Ten constraint lay dung tu migration tao bang audit_logs.
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      DROP CONSTRAINT "ck_audit_logs_action"
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD CONSTRAINT "ck_audit_logs_action"
      CHECK ("action" IN (
        'user.role_changed',
        'user.suspended',
        'user.unsuspended',
        'work.approved',
        'work.rejected',
        'settings_changed'
      ))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      DROP CONSTRAINT "ck_audit_logs_action"
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD CONSTRAINT "ck_audit_logs_action"
      CHECK ("action" IN (
        'user.role_changed',
        'user.suspended',
        'user.unsuspended',
        'work.approved',
        'work.rejected'
      ))
    `);
    await queryRunner.query('DROP TABLE "site_settings"');
  }
}
