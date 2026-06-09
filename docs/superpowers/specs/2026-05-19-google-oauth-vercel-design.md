# Google OAuth on Vercel Design

## Goal

Add Google login to the GTO preflop chart app while preserving the existing whole-page password gate. A user must enter the shared page password and complete Google OAuth before chart data loads.

## Constraints

- Keep the current React + TypeScript + Vite app structure.
- Use Vercel serverless functions for auth APIs.
- Continue supporting the existing Vercel deployment path.
- Do not rely on client-only checks for final access control.
- Keep GitHub Pages build compatibility where possible, but Google OAuth only works on deployments with the Vercel API routes.

## User Flow

1. The app starts unauthenticated.
2. The login screen shows the existing password input and a Google login button.
3. The user enters the shared page password and clicks the Google button.
4. The frontend calls `POST /api/auth/google/start` with the password.
5. The server validates the password hash from `PASSWORD_HASH`.
6. If valid, the server creates an OAuth state token, stores it in a short-lived HttpOnly cookie, and returns the Google OAuth URL.
7. The frontend redirects the browser to Google.
8. Google redirects back to `GET /api/auth/callback`.
9. The callback validates the OAuth state, exchanges the authorization code, fetches the Google profile, checks the optional `ALLOWED_EMAILS` allowlist, then creates an HttpOnly app session cookie.
10. The callback redirects to the app root.
11. The app calls `GET /api/auth/me`; if authenticated, chart data loads.

## API Routes

### `POST /api/auth/google/start`

Request body:

```json
{ "password": "shared page password" }
```

Behavior:

- Hash the submitted password with SHA-256.
- Compare it to server-side `PASSWORD_HASH`.
- Return `401` for invalid passwords.
- Create a random OAuth state value.
- Store the state in `oauth_state` as an HttpOnly, Secure, SameSite=Lax cookie.
- Return `{ "url": "https://accounts.google.com/o/oauth2/v2/auth?..." }`.

### `GET /api/auth/callback`

Behavior:

- Validate `state` against the `oauth_state` cookie.
- Exchange `code` with Google's token endpoint.
- Fetch the user profile from Google's userinfo endpoint.
- If `ALLOWED_EMAILS` is set, require the profile email to be listed.
- Create a signed app session cookie.
- Clear the temporary OAuth state cookie.
- Redirect to `/`.

### `GET /api/auth/me`

Behavior:

- Validate the signed app session cookie.
- Return `{ "authenticated": true, "user": { "email": "...", "name": "...", "picture": "..." } }` for valid sessions.
- Return `{ "authenticated": false }` for missing or invalid sessions.

### `POST /api/auth/logout`

Behavior:

- Clear the app session cookie.
- Return `{ "ok": true }`.

## Frontend Changes

- Replace the current hash-only `useAuth` behavior with API-backed session checks.
- Keep the password input in `PasswordGate`.
- Change the submit action to start Google OAuth.
- Show loading and error states for password rejection, API failure, and unsupported static deployments.
- Keep chart data loading gated by `isAuthenticated`.

## Environment Variables

Required on Vercel:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`
- `PASSWORD_HASH`

Optional on Vercel:

- `ALLOWED_EMAILS` as a comma-separated list.

`PASSWORD_HASH` is a SHA-256 hex digest of the shared page password. `AUTH_SECRET` signs session cookies and should be a long random value.

## Security Notes

- The shared password is checked only on the server.
- The final session is stored in an HttpOnly cookie, not local storage.
- OAuth state is protected by a short-lived HttpOnly cookie.
- Email allowlisting is enforced on the server.
- The encrypted chart data remains build-time decrypted for Vercel as it is today.

## Testing

- Unit test auth helpers: hashing comparison, signed session creation, signed session verification, allowlist parsing.
- Build with `npm run build`.
- Manually verify login failures and OAuth redirects when Vercel environment variables are configured.
