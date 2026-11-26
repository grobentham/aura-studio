# Google Drive sync: one-time setup

Google Drive sync stays hidden until a Google OAuth client ID is pasted into `aura-config.js`. It's free. Each user's projects go to a private app folder in **their own** Drive (the `drive.appdata` scope). Aura can't see any of their other files, and there's no Aura server.

## Steps (about 10 minutes)

1. Go to https://console.cloud.google.com/ and create a project, for example "Aura Studio".
2. Open **APIs & Services → Library**, search for **Google Drive API** and click **Enable**.
3. Open **APIs & Services → OAuth consent screen** (on newer consoles this is **Google Auth Platform → Branding / Audience / Data access**):
   - App name: Aura Studio. Add your support email.
   - Audience: **External**.
   - Data access / scopes: add `https://www.googleapis.com/auth/drive.appdata`.
   - While the app is in **Testing**, add your own Google account as a test user. To let anyone sign in, click **Publish app**. The appdata scope is non-sensitive, so it doesn't need Google's full security review.
4. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorised JavaScript origins: `https://grobentham.github.io` (and `http://localhost:4173` for local testing).
   - No redirect URI is needed.
5. Copy the client ID (it ends in `.apps.googleusercontent.com`) into `aura-config.js`:

   ```js
   window.AURA_CONFIG = { googleClientId: '1234-abc.apps.googleusercontent.com' };
   ```

6. Bump `aura-config.js?v=` in `index.html` and `sw.js`, and bump `RELEASE` in `sw.js`, then publish.

## How sync works

- Every project is stored as one JSON file in the hidden app folder. A newer `updated` timestamp wins in either direction (`backup-core.js` → `plan`).
- Project audio is uploaded once per asset as a WAV file and downloaded only when it's missing locally.
- Sign-in tokens are kept in memory only, and nothing is uploaded until the user clicks **Sign in & sync**.

## Limitations

- If the same project is edited on two devices between syncs, the newer save wins. There's no per-note merge.
- Sync runs when the user clicks **Sync now**; it doesn't run in the background.
