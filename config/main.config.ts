import { registerAs } from '@nestjs/config';

export class MainConfig {
  inDevelopment: boolean;
  host: string;
  port: number;
  swaggerTitle: string;
  swaggerDescription: string;
  domain: string;
  apiDomain: string;
  resourceFolder: string;
  title: string;
}

export const CONFIG_NAME_MAIN = 'MAIN_CONFIG';

export default registerAs(CONFIG_NAME_MAIN, () => ({
  inDevelopment: process.env.ENVIRONMENT === process.env.ENVIRONMENT_DEV,
  host: process.env.HOST,
  port: process.env.PORT,
  swaggerTitle: process.env.MAIN_TITLE,
  swaggerDescription: process.env.SWAGGER_DESCRIPTION,
  domain: process.env.DOMAIN,
  apiDomain: process.env.API_URL,
  resourceFolder: process.env.RESOURCE_FOLDER_LOCATION,
  title: process.env.MAIN_TITLE,
}));
