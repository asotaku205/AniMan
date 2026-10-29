import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWorkSubmissions1793232564000 implements MigrationInterface {
  name = "CreateWorkSubmissions1793232564000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "work_submissions" (
        "id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "type" text NOT NULL,
        "title" text NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "genre" text NOT NULL DEFAULT '',
        "tags" text array NOT NULL DEFAULT '{}',
        "visibility" text NOT NULL,
        "cover_path" text,
        "file_name" text NOT NULL,
        "file_size" integer NOT NULL,
        "file_path" text NOT NULL,
        "mime_type" text NOT NULL,
        "source_ref" jsonb,
        "status" text NOT NULL DEFAULT 'pending',
        "reject_reason" text,
        "reviewed_by_id" uuid,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_submissions" PRIMARY KEY ("id"),
        CONSTRAINT "ck_work_submissions_type"
          CHECK ("type" IN ('manga', 'novel', 'animation', 'fanart')),
        CONSTRAINT "ck_work_submissions_visibility"
          CHECK ("visibility" IN ('public', 'unlisted', 'private')),
        CONSTRAINT "ck_work_submissions_status"
          CHECK ("status" IN ('pending', 'approved', 'rejected'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_work_submissions_status_created"
      ON "work_submissions" ("status", "created_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "work_submissions"');
  }
}
