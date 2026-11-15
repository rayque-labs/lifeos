# LifeOS Monolith — Android debug

This branch builds an Android debug wrapper using Capacitor 7 in GitHub Actions.
It does not yet include the approved custom launcher icon in Android resources.

## Prerequisites

Set the GitHub Actions repository variable `LIFEOS_API_URL` to the publicly reachable **HTTPS** backend origin (no trailing slash). The frontend defaults to `http://localhost:8000`, which would point to the phone itself and **cannot work** as the deployed backend.

The API must allow the Capacitor WebView origin (`https://localhost`) in its CORS policy, or API requests will fail. Check authentication and API connectivity on a real device before release.

## Build

Open GitHub Actions → **Android debug APK** → Run workflow.
Download the `lifeos-monolith-debug-apk` artifact from the completed run.

The workflow creates a temporary native Android project; no Android directory is committed yet. Capacitor dependencies are installed transiently for this build, so dependency versions should be locked before a production release.

## Remaining work

- Import the user's approved PNG as Android launcher icons (mipmap densities and adaptive icon).
- Add the transparent knot asset as `frontend/public/lifeos-symbol.webp` for the animated web intro.
- Verify device safe areas, back button behavior, and login/session persistence.
- Configure production signing and stable application ID before distribution.
