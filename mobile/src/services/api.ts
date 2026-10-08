// Compatibility facade: screens keep their current imports during the migration.
// Every cricket function below uses SQLite; only authentication uses HTTP.
export * from './localCricket';
export { API_URL, authenticate, logout, getHealth } from './authApi';
