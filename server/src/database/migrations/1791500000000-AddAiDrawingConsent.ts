import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddAiDrawingConsent1791500000000 implements MigrationInterface {
  name = "AddAiDrawingConsent1791500000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "ai_age_confirmed_at" timestamptz,
      ADD COLUMN "ai_data_notice_version" text,
      ADD CONSTRAINT "ck_users_ai_drawing_consent_pair"
        CHECK (
          ("ai_age_confirmed_at" IS NULL AND "ai_data_notice_version" IS NULL)
          OR
          ("ai_age_confirmed_at" IS NOT NULL AND "ai_data_notice_version" IS NOT NULL)
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP CONSTRAINT "ck_users_ai_drawing_consent_pair",
      DROP COLUMN "ai_data_notice_version",
      DROP COLUMN "ai_age_confirmed_at"
    `);
  }
}
