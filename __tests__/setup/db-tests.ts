// @vitest-environment node
/**
 * Global setup for database tests
 * This ensures DATABASE_URL is properly managed for testcontainers
 */

// Unset DATABASE_URL to let testcontainers handle it
// This prevents the global db module from connecting to the wrong database
delete process.env.DATABASE_URL;

export {};
