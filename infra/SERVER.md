# SERVER.md — Sosial production VPS record

## Box
- Provider: Leaseweb · Singapore · 6 vCPU / 16 GB / 200 GB NVMe
- Price: ~S$15.88/mo · Acronis 50 GB secondary
- OS: Ubuntu 26.04 distribution-only · Docker Engine (apt, pinned)
- IP: _FILL AT PROVISION_
- Access: SSH key only, password auth off, UFW 22/80/443, fail2ban

## DNS (Cloudflare)
- `db.sosial.app` → VPS IP (proxied) — Kong gateway :8000
- `status.sosial.app` → VPS IP (proxied) — Uptime Kuma :3001
- Photo host behind Cloudflare through the app domain path (see TT_PHOTO_HOST_PUBLIC)

## Layout on disk
- `/opt/sosial/supabase` — official self-hosted compose (release pinned: _FILL_, PG17 to match cloud)
- `/opt/sosial/infra` — this repo's infra/ (services compose, .env, backup.sh)
- `/var/backups/sosial` — local dumps (pruned, R2 is the real copy)
- Realtime + Studio: OFF (verified zero realtime usage; Studio via psql/CLI)

## Compose
- Supabase stack: Kong :8000, GoTrue, PostgREST, Storage, edge-runtime, Supavisor, Postgres :5432
- `infra/docker-compose.services.yml`: worker, photo-host (:3000 loopback), uptime-kuma (:3001 loopback)
- Services reach Kong/Postgres via `host.docker.internal` (host-gateway)
- Log caps on every service (no disk-eating json logs)

## Restore (disaster procedure)
1. Fresh box + base install (Stage 1 commands)
2. `aws s3 cp s3://sosial-backups/sosial/<latest-pg>.sql.gz - | gunzip | psql` (or `supabase db reset` + data restore per runbook)
3. Re-copy buckets from R2 (`aws s3 sync s3://sosial-media/post-media/ ...`)
4. Re-inject 34 secrets, `docker compose up -d`, run E2E checklist
5. Monthly restore TEST (untested backups aren't backups)

## Migration references
- Full runbook: chat history 2026-10-14 (7 phases + E2E checklist)
- JWT rotation: new anon/service keys minted Stage 1, rotated everywhere in cutover window
- Vault: schema migrates, contents reconnected by users post-cutover
- Rollback: repoint envs to paused cloud project (kept 2 weeks, then org deleted)
