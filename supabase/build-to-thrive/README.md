# Build to Thrive - leaderboard + admin setup

Runs against the repurposed old Kumamoto Supabase project (`qrblhtyoslxvoyyafgkl`),
never the LFE project. See the STATUS note at the top of `supabase/schema.sql`.

## One-time setup

1. **Schema.** Run `supabase/build-to-thrive/schema.sql` in that project's SQL
   editor (or `supabase db push` once linked to it). Creates
   `build_to_thrive_scores` plus the two RPCs the game page calls directly:
   `submit_build_to_thrive_score` and `get_build_to_thrive_leaderboard`.
   Neither the anon key nor those two RPCs can ever read the `email` column -
   only the admin Edge Function (service-role) can.

2. **Deploy the admin Edge Function with JWT verification off.** No Supabase
   session is needed to call it at all - `admin_password` (checked
   server-side, inside the function) is the only real gate. (Anonymous
   sign-in was tried first for this instead, but it turns out
   `signInAnonymously()` is also blocked by "Allow new users to sign up" -
   it creates an `auth.users` row too, so GoTrue treats it as a signup. That
   toggle needs to stay off, see the note in the main STATUS section, so
   `verify_jwt = false` on just this one function is the right fix instead.)
   - CLI (this local checkout isn't linked to this project - it's linked to
     LFE - so pass `--project-ref` explicitly):
     ```
     supabase functions deploy build-to-thrive-admin-list --project-ref qrblhtyoslxvoyyafgkl --no-verify-jwt
     ```
   - Dashboard: after deploying (or redeploying) the function, open it in
     Edge Functions and turn off "Enforce JWT Verification" in its settings.

3. **Set the admin password secret** (pick your own value):
   ```
   supabase secrets set ADMIN_PASSWORD=your-password-here --project-ref qrblhtyoslxvoyyafgkl
   ```
   Dashboard equivalent: Edge Functions -> Secrets.

4. Visit `/build-to-thrive/admin/` and log in with that password to see
   every submission (name, email, score, building type, timestamp).

## Files

- `schema.sql` - table, RLS (no direct grants - anon only ever goes through
  the two RPCs), and the two RPCs.
- `../functions/build-to-thrive-admin-list/index.ts` - the admin-only Edge
  Function (service-role read, password-gated), deployed with JWT
  verification off per step 2 above.
- `../../public/build-to-thrive/index.html` - the game itself.
- `../../public/build-to-thrive/admin/index.html` - the admin page (step 4).
