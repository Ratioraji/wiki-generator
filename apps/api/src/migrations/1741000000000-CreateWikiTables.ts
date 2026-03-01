import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWikiTables1741000000000 implements MigrationInterface {
  name = 'CreateWikiTables1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── wikis ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "wikis" (
        "id"                     UUID        NOT NULL DEFAULT gen_random_uuid(),
        "repo_url"               VARCHAR(500) NOT NULL,
        "repo_name"              VARCHAR(200) NOT NULL,
        "branch"                 VARCHAR(200) NOT NULL,
        "repo_summary"           TEXT,
        "status"                 VARCHAR(20)  NOT NULL DEFAULT 'processing',
        "total_files"            INT,
        "total_subsystems"       INT,
        "processing_started_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "completed_at"           TIMESTAMPTZ,
        "deleted_at"             TIMESTAMPTZ,
        "created_at"             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_wikis_id" PRIMARY KEY ("id")
      )
    `);

    // Partial unique index: one active wiki per repo+branch
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_wikis_repo_branch_active"
        ON "wikis" ("repo_url", "branch")
        WHERE "deleted_at" IS NULL
    `);

    // ── wiki_subsystems ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "wiki_subsystems" (
        "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
        "wiki_id"           UUID         NOT NULL,
        "group_id"          VARCHAR(100) NOT NULL,
        "name"              VARCHAR(200) NOT NULL,
        "description"       TEXT,
        "overview"          TEXT         NOT NULL,
        "how_it_works"      TEXT,
        "public_interfaces" JSONB,
        "citations"         JSONB,
        "dependencies"      TEXT[],
        "key_files"         TEXT[],
        "display_order"     INT          NOT NULL DEFAULT 0,
        "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_wiki_subsystems_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_wiki_subsystems_wiki_id"
          FOREIGN KEY ("wiki_id") REFERENCES "wikis" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_wiki_subsystems_wiki_id"
        ON "wiki_subsystems" ("wiki_id")
    `);

    // ── wiki_file_maps ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "wiki_file_maps" (
        "id"                 UUID         NOT NULL DEFAULT gen_random_uuid(),
        "wiki_id"            UUID         NOT NULL,
        "file_path"          VARCHAR(500) NOT NULL,
        "group_id"           VARCHAR(100) NOT NULL,
        "summary"            TEXT,
        "function_summaries" JSONB,
        "created_at"         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_wiki_file_maps_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_wiki_file_maps_wiki_id"
          FOREIGN KEY ("wiki_id") REFERENCES "wikis" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_wiki_file_maps_wiki_id"
        ON "wiki_file_maps" ("wiki_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wiki_file_maps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wiki_subsystems"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_wikis_repo_branch_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wikis"`);
  }
}
