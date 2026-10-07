import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuthTables1780768800000 implements MigrationInterface {
  name = "CreateAuthTables1780768800000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL,
        "username" text NOT NULL,
        "display_name" text NOT NULL,
        "password_hash" text NOT NULL,
        "terms_accepted_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_username" UNIQUE ("username"),
        CONSTRAINT "ck_users_username_normalized"
          CHECK ("username" = lower("username")),
        CONSTRAINT "ck_users_username_format"
          CHECK ("username" ~ '^[a-z0-9_]+$')
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "refresh_sessions" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "family_id" uuid NOT NULL,
        "token_hash" char(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "replaced_by_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_refresh_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_refresh_sessions_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "ck_refresh_sessions_token_hash_format"
          CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
        CONSTRAINT "fk_refresh_sessions_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_refresh_sessions_replaced_by_id"
          FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_sessions"("id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_refresh_sessions_user_id"
      ON "refresh_sessions" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_refresh_sessions_family_id"
      ON "refresh_sessions" ("family_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "refresh_sessions"');
    await queryRunner.query('DROP TABLE "users"');
  }
}
