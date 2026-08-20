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

2. **Enable anonymous sign-in.** In that project's dashboard: Authentication
   -> Providers -> Anonymous -> enable. Only needed for the admin page - it
   uses an anonymous session purely to satisfy the Edge Function gateway's
   JWT requirement; the real gate is the admin password, checked
   server-side. The main game page doesn't need this (its two RPCs need no
   auth session at all).

3. **Deploy the admin Edge Function** (this local checkout isn't linked to
   this project - it's linked to LFE - so link to this one first, or pass
   `--project-ref` explicitly as below):
   ```
   supabase functions deploy build-to-thrive-admin-list --project-ref qrblhtyoslxvoyyafgkl
   ```

4. **Set the admin password secret** (pick your own value):
   ```
   supabase secrets set ADMIN_PASSWORD=your-password-here --project-ref qrblhtyoslxvoyyafgkl
   ```

5. Visit `/build-to-thrive/admin/` and log in with that password to see
   every submission (name, email, score, building type, timestamp).

## Files

- `schema.sql` - table, RLS (no direct grants - anon only ever goes through
  the two RPCs), and the two RPCs.
- `../functions/build-to-thrive-admin-list/index.ts` - the admin-only Edge
  Function (service-role read, password-gated), deployed per step 3 above.
- `../../public/build-to-thrive/index.html` - the game itself.
- `../../public/build-to-thrive/admin/index.html` - the admin page (step 5).
