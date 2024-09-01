import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/lib/models.ts',
  out: './drizzle',
  dialect: 'sqlite',
  verbose: true,
  strict: true,
  dbCredentials: {
    url: './src/lib/database.db',
  },
})