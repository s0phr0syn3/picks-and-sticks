import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/lib/server/models.ts',
  out: './drizzle',
  dialect: 'sqlite',
  verbose: true,
  strict: true,
  dbCredentials: {
    url: './src/lib/server/database.db',
  },
})