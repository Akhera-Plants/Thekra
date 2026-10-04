import { defineConfig } from 'prisma/config';

// DATABASE_URL is read from prisma/schema.prisma (env("DATABASE_URL")).
// The seed command uses Node's --env-file flag to load .env so PrismaClient
// can resolve DATABASE_URL without a dotenv dependency in the seed script.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --env-file=.env --experimental-strip-types prisma/seed.ts',
  },
});
