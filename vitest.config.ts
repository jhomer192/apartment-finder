import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/**/*.test.ts', 'src/**/*.test.ts'],
    env: {
      DATABASE_PATH: ':memory:',
      ALLOWED_EMAILS: 'test@example.com',
      ADMIN_EMAIL: 'test@example.com',
    },
  },
});
