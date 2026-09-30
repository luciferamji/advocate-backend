// Tests run against a THROWAWAY Postgres (see scripts/test-db.sh). The schema
// is dropped and recreated, so refuse to run against anything else.
process.env.NODE_ENV = 'test';
process.env.DB_HOST = process.env.TEST_DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.TEST_DB_PORT || '55432';
process.env.DB_USER = process.env.TEST_DB_USER || 'adv_test';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'adv_test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'advocate_test';
process.env.FRONTEND_URL = 'http://localhost:5173';
delete process.env.SUPER_ADMIN_PASSWORD;
delete process.env.CORS_ORIGINS;
delete process.env.WEBSITE_DEFAULT_OFFICE;

if (!/_test$/.test(process.env.DB_NAME)) {
  throw new Error(`Refusing to run tests against database "${process.env.DB_NAME}" (name must end with _test)`);
}
