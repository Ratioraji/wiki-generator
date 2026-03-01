import { AppDataSource } from '../datasource';

await AppDataSource.initialize();
await AppDataSource.undoLastMigration({ transaction: 'each' });
console.log('Last migration reverted.');
await AppDataSource.destroy();
