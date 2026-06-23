try {
  process.loadEnvFile();
} catch {
  // No .env file — fall back to the ambient environment.
}
