import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerCustomOptions,
  SwaggerModule,
} from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { CONFIG_NAME_MAIN, MainConfig } from 'config/main.config';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files from public directory
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/public/',
  });

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      exceptionFactory: (errors) => {
        const formattedMessage = errors
          .map((err) =>
            err.constraints ? Object.values(err.constraints).join(', ') : '',
          )
          .join(', ');

        return new BadRequestException({
          statusCode: 400,
          status: 'FAILED',
          message: formattedMessage,
        });
      },
    }),
  );

  const configService = app.get(ConfigService);
  const mainConfig = configService.get<MainConfig>(CONFIG_NAME_MAIN);
  if (!mainConfig) {
    throw new Error(`Configuration "${CONFIG_NAME_MAIN}" not found`);
  }

  app.enableCors({
    origin: true, // allow any origin with credentials
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'Origin',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods',
    ],
    exposedHeaders: ['Authorization'],
    credentials: true,
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  });

  app.useLogger(app.get(Logger));
  app.use(cookieParser());

  app.use(
    session({
      secret: 'my-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 3600000,
      },
    }),
  );

  const port = mainConfig.port;
  const host = mainConfig.host;

  const swaggerConfig = new DocumentBuilder()
    .setTitle(mainConfig.title)
    .setDescription(mainConfig.swaggerDescription)
    .setVersion('1.0')
    .addBearerAuth(
      {
        description: 'Please enter token in following format: Bearer <JWT>',
        name: 'Authorization',
        bearerFormat: 'Bearer',
        scheme: 'Bearer',
        type: 'http',
        in: 'Header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const customOptions: SwaggerCustomOptions = {
    swaggerOptions: {
      withCredentials: true,
    },
  };
  SwaggerModule.setup('api-swagger', app, document, customOptions);

  await app.listen(port, host);

  const path = `http://${host}:${port}`;
  console.log(`Server is listening on port: ${path}`);
  console.log(' ');
  console.log(`API docs path: ${path}/api-swagger`);
  console.log(' ');
}
bootstrap();
