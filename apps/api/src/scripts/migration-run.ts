import { AppDataSource } from '../datasource';

await AppDataSource.initialize();

const pending = await AppDataSource.showMigrations();
if (!pending) {
  console.log('No pending migrations.');
} else {
  const ran = await AppDataSource.runMigrations({ transaction: 'each' });
  console.log(`Ran ${ran.length} migration(s):`);
  ran.forEach((m) => console.log(`  ✓ ${m.name}`));
}

await AppDataSource.destroy();
