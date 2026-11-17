# LifeOS Monolith — Android offline

The Android debug workflow builds with `VITE_OFFLINE_MODE=true`, without an external API. The Android wrapper embeds the React application and all of its JavaScript.

## Implemented

- Offline CRUD for tasks, notes, projects, habits, calendar events, finance accounts, categories and transactions.
- Dashboard assembled from local records.
- Project progress from linked tasks; basic daily and weekly habit streak calculations.
- Finance balances, income/expense totals and per-category monthly summaries.
- Local profile and offline mode without login.
- JSON backup export/import from Settings.

## Important limitations

- **Native SQLite integration under validation:** the Android build now includes a SQLite key/value bridge. It imports existing localStorage data on first launch and mirrors subsequent writes. Physical-device persistence and migration have not yet been tested; do not treat it as production-grade financial storage. The browser development build still uses localStorage.
- **Backups are unencrypted** JSON. Store them safely. Import replaces local data; verify backups before relying on them.
- Local data is stored per app installation; uninstalling or clearing app data may delete it.
- The APK has not been tested on a physical Android phone.
- Custom launcher icon and approved splash image are not yet included in the GitHub repository.
- Recurring tasks, complex calendar edge cases, financial precision and complete backend parity still need validation.
- This is a debug-signed APK, not a Play Store release.

## Build and download

GitHub Actions → **Android debug APK** → latest successful run → Artifacts → `lifeos-monolith-debug-apk`.

No `LIFEOS_API_URL` variable is required for offline builds.

## Release gates

1. Validate the native SQLite bridge on a physical device, including migration from the previous localStorage-only APK, transactions and app restarts.
2. Test every module in airplane mode, across restarts, on a physical Android device.
3. Include approved launcher and splash assets.
4. Add integration tests for data consistency and backups.
5. Configure release signing and versioning.
