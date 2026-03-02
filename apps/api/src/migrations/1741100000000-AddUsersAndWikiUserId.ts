import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsersAndWikiUserId1741100000000 implements MigrationInterface {
  name = 'AddUsersAndWikiUserId1741100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Create users table ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
        "github_id"    VARCHAR(50)  NOT NULL,
        "username"     VARCHAR(100) NOT NULL,
        "display_name" VARCHAR(200),
        "email"        VARCHAR(300),
        "avatar_url"   VARCHAR(500),
        "access_token" TEXT,
        "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_users_github_id"
        ON "users" ("github_id")
    `);

    // ── Add user_id to wikis ────────────────────────────────────────────────
    // 1. Create a system user for existing wikis (pre-auth data)
    await queryRunner.query(`
      INSERT INTO "users" ("id", "github_id", "username", "display_name")
      VALUES ('00000000-0000-0000-0000-000000000000', '0', 'system', 'System User')
    `);

    // 2. Add user_id column as nullable first
    await queryRunner.query(`
      ALTER TABLE "wikis"
        ADD COLUMN "user_id" UUID
    `);

    // 3. Backfill existing wikis with system user
    await queryRunner.query(`
      UPDATE "wikis" SET "user_id" = '00000000-0000-0000-0000-000000000000'
      WHERE "user_id" IS NULL
    `);

    // 4. Make column NOT NULL
    await queryRunner.query(`
      ALTER TABLE "wikis"
        ALTER COLUMN "user_id" SET NOT NULL
    `);

    // 5. Add FK constraint
    await queryRunner.query(`
      ALTER TABLE "wikis"
        ADD CONSTRAINT "FK_wikis_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
    `);

    // 6. Index on user_id
    await queryRunner.query(`
      CREATE INDEX "idx_wikis_user_id"
        ON "wikis" ("user_id")
    `);

    // ── Replace unique index with user-scoped version ───────────────────────
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_wikis_repo_branch_active"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_wikis_repo_branch_user_active"
        ON "wikis" ("repo_url", "branch", "user_id")
        WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore old unique index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_wikis_repo_branch_user_active"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_wikis_repo_branch_active"
        ON "wikis" ("repo_url", "branch")
        WHERE "deleted_at" IS NULL
    `);

    // Remove user_id from wikis
    await queryRunner.query(`
      ALTER TABLE "wikis" DROP CONSTRAINT IF EXISTS "FK_wikis_user_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_wikis_user_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "wikis" DROP COLUMN IF EXISTS "user_id"
    `);

    // Drop users table
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_github_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
