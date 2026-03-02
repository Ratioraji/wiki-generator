import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisProvider } from './providers/redis.provider';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { WikiModule } from './wiki/wiki.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
      username: process.env.DATABASE_USER ?? 'postgres',
      password: process.env.DATABASE_PASSWORD ?? 'postgres',
      database: process.env.DATABASE_NAME ?? 'wiki_generator',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
      autoLoadEntities: true,
      retryAttempts: 3,
      retryDelay: 3000,
    }),
    AuthModule,
    WikiModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, RedisProvider],
})
export class AppModule {}
