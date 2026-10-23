# Deploying to the VPS

`.github/workflows/deploy-vps.yml` deploys the worker and the edge functions when a change under
`apps/worker/`, `supabase/functions/` or `infra/docker-compose.services.yml` lands on `main`.
You can also run it by hand from the Actions tab (choose both / worker / functions).

## One-time setup

1. On your own computer, make a key used only for deploys (no passphrase):
   `ssh-keygen -t ed25519 -f sosial-deploy -C github-deploy -N ""`
2. On the VPS, add `sosial-deploy.pub` to `~sosial/.ssh/authorized_keys`, preferably prefixed with
   `restrict,` so it cannot forward ports or open agents.
3. In GitHub > Settings > Secrets and variables > Actions, add:
   - `VPS_HOST` = 23.111.15.38
   - `VPS_USER` = sosial
   - `VPS_SSH_KEY` = the full contents of the private file `sosial-deploy`
4. Delete the private key file from your computer after saving it as a secret.

The user needs `rsync` on the server and membership of the `docker` group (already the case).

## What it does

- Worker: rsync `apps/worker/` to `/opt/sosial/apps/worker/`, then `docker compose build worker && up -d worker` in `/opt/sosial/infra`.
- Edge functions: rsync `supabase/functions/` to `/opt/sosial/supabase/docker/volumes/functions/` (no delete), then `docker compose restart functions`.
- Server `.env` files are never touched.
