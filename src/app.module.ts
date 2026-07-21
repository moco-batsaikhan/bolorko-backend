import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './api/auth/auth.module';
import { UserModule } from './api/user/user.module';
import { ApiModule } from './api/api.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as fileStreamRotator from 'file-stream-rotator';
import mainConfig from 'config/main.config';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'path';
import DatabaseConfig from 'config/database.config';
import pino from 'pino';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ApiModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [mainConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useClass: DatabaseConfig,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'public'),
    }),

    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req) => {
          req.id = Math.floor(100000 + Math.random() * 900000);
          return req.id;
        },
        serializers: {
          req: (req) => {
            req.body = req.raw.body;
            return req;
          },
          res: (res) => {
            res.body = res.raw.responseBody;
            return res;
          },
        },
        stream: pino.multistream([
          {
            level: 'trace',
            stream: fileStreamRotator.getStream({
              filename: 'var/logs/debug-%DATE%.log',
              frequency: 'daily',
              verbose: false,
              max_logs: '10',
            }),
          },
          {
            level: 'error',
            stream: fileStreamRotator.getStream({
              filename: 'var/logs/error-%DATE%.log',
              frequency: 'daily',
              verbose: false,
              max_logs: '10',
            }),
          },
          {
            level: 'trace',
            write(msg) {
              console.log(msg);
            },
          },
        ]),
        timestamp: () => {
          return `, "time": "${format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS')}"`;
        },
      },
    }),

    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
