import { Logger } from '@nestjs/common';
import type { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

const logger = new Logger('RedisProvider');

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (): Redis => {
    const client = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    client.on('connect', () => {
      logger.log(`Connected to Redis at ${process.env.REDIS_HOST ?? 'localhost'}:${process.env.REDIS_PORT ?? '6379'}`);
    });

    client.on('error', (err: Error) => {
      logger.error(`Redis connection error: ${err.message}`);
    });

    client.on('reconnecting', () => {
      logger.warn('Reconnecting to Redis...');
    });

    return client;
  },
};
