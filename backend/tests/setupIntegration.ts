import 'dotenv/config';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database before running integration tests.');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
