import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import CONSTANTS from 'src/common/constants/constants.const';

const CONNECTION_TYPE = 'mysql';
export const MAIN_DB_CONNECTION = 'default';

@Injectable()
export default class DatabaseConfig implements TypeOrmOptionsFactory {
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      name: MAIN_DB_CONNECTION,
      type: CONNECTION_TYPE as 'mysql',
      host: process.env.DATABASE_HOST,
      port: +(process.env.DATABASE_PORT ?? 3306),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      synchronize: true,
      logging: process.env.ENVIRONMENT !== process.env.ENVIRONMENT_PROD,
      entities: CONSTANTS.entities,
      migrations: ['dist/src/database/migrations/*.js'],
      migrationsRun: false,
    };
  }
}
