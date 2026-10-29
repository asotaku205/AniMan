import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuditLogs1793234022000 implements MigrationInterface {
  name = "CreateAuditLogs1793234022000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL,
        "actor_id" uuid NOT NULL,
        "actor_username" text NOT NULL,
        "action" text NOT NULL,
        "target_type" text NOT NULL,
        "target_id" text NOT NULL,
        "target_label" text NOT NULL,
        "detail" jsonb NOT NULL DEFAULT '{}',
        "ip" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "ck_audit_logs_action"
          CHECK ("action" IN (
            'user.role_changed',
            'user.suspended',
            'user.unsuspended',
            'work.approved',
            'work.rejected'
          ))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_created"
      ON "audit_logs" ("created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_actor"
      ON "audit_logs" ("actor_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_action"
      ON "audit_logs" ("action")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "audit_logs"');
  }
}
