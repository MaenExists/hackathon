# Web application

Application source for the independent Corridor hackathon prototype. Start with the [repository README](../README.md) for setup, demonstration and checks.

The Sites/Vinext runtime helpers under `scripts/`, `worker/` and `vite.config.ts` support both local development and private deployment. `scripts/migrate-local.mjs` applies generated schema migrations to local D1 only. Hosted publication applies the committed Drizzle migrations separately.
