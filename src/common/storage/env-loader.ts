import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// This module is imported before the Spaces/S3 client is constructed below
// so that SPACES_* env vars are available even when this file loads ahead of
// Nest's own ConfigModule.forRoot() (which only runs once AppModule's
// imports — including this controller's module — have already been
// evaluated). Mirrors ConfigModule's envFilePath priority: .env.local wins
// over .env, since dotenv.config() never overwrites an already-set key.
for (const file of ['.env.local', '.env']) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) {
    config({ path, quiet: true });
  }
}
