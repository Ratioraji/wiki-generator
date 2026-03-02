/**
 * Standalone migration runner for production.
 *
 * Compiled by `nest build` to `dist/migration-runner.js`.
 * Used as Fly.io release_command: `node dist/migration-runner.js`
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './auth/entities/user.entity';
import { Wiki } from './wiki/entities/wiki.entity';
import { WikiSubsystem } from './wiki/entities/wiki-subsystem.entity';
import { WikiFileMap } from './wiki/entities/wiki-file-map.entity';
import { CreateWikiTables1741000000000 } from './migrations/1741000000000-CreateWikiTables';
import { AddUsersAndWikiUserId1741100000000 } from './migrations/1741100000000-AddUsersAndWikiUserId';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres',
  database: process.env.DATABASE_NAME ?? 'wiki_generator',
  entities: [User, Wiki, WikiSubsystem, WikiFileMap],
  migrations: [CreateWikiTables1741000000000, AddUsersAndWikiUserId1741100000000],
  synchronize: false,
  logging: ['query', 'error', 'schema'],
});

async function run() {
  await dataSource.initialize();
  console.log('Connected to database.');

  const pending = await dataSource.showMigrations();
  if (!pending) {
    console.log('No pending migrations.');
  } else {
    const ran = await dataSource.runMigrations({ transaction: 'each' });
    console.log(`Ran ${ran.length} migration(s):`);
    ran.forEach((m) => console.log(`  ✓ ${m.name}`));
  }

  await dataSource.destroy();
  console.log('Migration runner complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
