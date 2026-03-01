import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Wiki } from './wiki/entities/wiki.entity';
import { WikiSubsystem } from './wiki/entities/wiki-subsystem.entity';
import { WikiFileMap } from './wiki/entities/wiki-file-map.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres',
  database: process.env.DATABASE_NAME ?? 'wiki_generator',
  entities: [Wiki, WikiSubsystem, WikiFileMap],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: ['query', 'error', 'schema'],
});
