# LifeOS local-first migration

The new optional `VITE_OFFLINE_MODE=true` feature flag bypasses login and uses a local data adapter for **tasks** and **notes** only. It is **not yet a complete offline app**.

Current implementation:
- Local user identity, without network authentication.
- Task and note CRUD stored in browser localStorage.
- Unsupported modules fail explicitly instead of silently contacting a remote server.
- The default build remains in online mode to avoid presenting unfinished offline behavior as production-ready.

Run `VITE_OFFLINE_MODE=true npm run dev` in frontend for incremental testing. Note that the dashboard, projects, habits, calendar, finance and settings API actions still need local adapters. The dashboard is the default route and will show an unsupported-module error in offline mode.

Before releasing an Android APK:
1. Implement all remaining module endpoints and aggregation semantics.
2. Replace temporary localStorage with native SQLite; add migrations and transaction-safe writes.
3. Provide encrypted or user-controlled export/import and verify backups.
4. Add Android icon/splash image assets from the approved original image.
5. Build and test offline on a real Android device, including process termination and restart.

Do not treat localStorage as durable production storage for financial data. Avoid switching the Android workflow to offline mode until all modules work.
