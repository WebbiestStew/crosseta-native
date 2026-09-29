# CrossETA server

Optional backend for the CrossETA app. Without it the app works fully on-device; with it you get:

| Feature | What the server does |
|---|---|
| **Real history** | Polls CBP every 5 min and records waits by weekday and hour on the *port's own clock*. Every device gets months of history immediately instead of building its own. |
| **Push alerts** | Evaluates each device's alert rules (same logic as the app) and sends Expo push notifications when the app is closed. |
| **Measured waits** | Aggregates drivers' tracked "I'm In Line" trips (opt-in) into a median measured wait per crossing and lane. |
| **Community reports** | Shared, moderated reports with votes and flags. |
| **Widget data** | `GET /v1/waits` lets the iOS widget refresh itself without the app running. |

Zero npm dependencies. Needs **Node 22.13+** (uses the built-in `node:sqlite`).

## Run it

```bash
cd server
npm start                      # http://localhost:8787, data in ./data/crosseta.db
npm test                       # 28 tests, no network needed
```

Point the app at it by starting Metro with the URL (or set `expo.extra.apiUrl` in `app.json`):

```bash
EXPO_PUBLIC_API_URL=http://localhost:8787 npx expo start --dev-client --clear
```

For a real phone use your machine's LAN address, or (for release) an `https://` URL. The Community tab
and the "Community & Alerts" settings appear only when a URL is configured.

## Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | Listen port |
| `DB_PATH` | `./data/crosseta.db` | SQLite file (back this up; it holds the history) |
| `POLL_MS` | `300000` | How often to poll CBP and evaluate alerts |
| `TRUST_PROXY` | unset | Set to `1` **only** behind a proxy you control that sets `X-Forwarded-For`; otherwise per-IP limits use the socket address |
| `FEED_URL` / `PUSH_URL` | CBP / Expo | Override for testing |
| `MIN_DEVICES` | `2` | Distinct devices needed before a measured wait is published |
| `DISABLE_POLL` | unset | `1` to serve without polling (tests) |

Put it behind HTTPS (Caddy, nginx, a platform load balancer) before shipping the app; iOS blocks plain
`http://` except for local networking.

## API

Auth is an anonymous per-install credential: `POST /v1/register` returns `{token}`; send it as
`Authorization: Bearer <token>`. No accounts, no emails.

Public: `GET /health`, `POST /v1/register`, `GET /v1/history/:id`, `GET /v1/history?ids=A,B`,
`GET /v1/waits?ids=A,B`, `GET /v1/community`.
Authenticated: `PUT|DELETE /v1/alerts`, `POST /v1/trips`, `GET|POST /v1/reports`,
`POST /v1/reports/:id/vote`, `POST /v1/reports/:id/flag`, `DELETE /v1/me` (erases everything for the device).

## Privacy and abuse controls

* Trips store crossing, lane and start/end time only: **no coordinates**, no name. Kept 30 days.
* Reports are kept 14 days. Device ids are never returned to other devices.
* A measured wait needs ≥ 2 different devices, uses each device once, and reports the median.
* Trips must be internally consistent (times match the wait), recent, and rate-limited.
* Report notes reject links and contact details; reports are rate-limited per device and crossing,
  de-duplicated, and auto-hidden once 3 different devices flag them.
* `DELETE /v1/me` (Settings → Delete my community data) erases the device and everything it contributed.

## Before you ship (things only you can do)

1. **Host it** over HTTPS and set `apiUrl` in `app.json`.
2. **Push notifications on real devices** need an EAS project id (`expo.extra.eas.projectId`), the Push
   Notifications capability, and an `aps-environment` entitlement in `ios/CrossETA/CrossETA.entitlements`,
   which requires a paid Apple Developer account. Push tokens can't be obtained on the Simulator.
   The server side is tested against a mock of Expo's push API, not against real devices.
3. **App Store privacy answers**: `ios/CrossETA/PrivacyInfo.xcprivacy` now declares user content, usage data and
   device ID (for app functionality, not tracking). Make your App Store Connect "App Privacy" answers match, and
   publish a privacy policy that says so.
4. **Moderation** is automated and minimal. If the Community tab gets real traffic you will want a way to review
   flagged reports (they are hidden, not deleted, until purged after 14 days).
