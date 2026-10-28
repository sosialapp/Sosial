# docs.sosial.app

The public docs are part of the `apps/web` Next.js app (Vercel project
`sosial-web`). No separate deployment.

## How it fits together

- **Content**: Supabase tables `docs_sections` and `docs_pages`
  (migration `supabase/migrations/20261028120000_p111_docs.sql`). Pages hold a
  markdown body, a `position` for sidebar order and a `published` flag.
- **Access**: RLS lets anyone read sections and published pages. Only
  `is_app_admin()` users can see drafts, insert, update or delete. The admin
  API (`/api/admin/docs/*`) checks `is_app_admin()` again before every write
  (401 when signed out, 403 for non-admins).
- **Editor**: `sosial.app/admin/docs`, inside the existing owner console.
  Non-admins get a 404 there, like the rest of `/admin`.
- **Routing**: `src/middleware.ts` maps any `docs.*` host onto the `/docs`
  route tree, so `docs.sosial.app/scheduling-posts` renders
  `src/app/docs/[slug]/page.tsx`. `sosial.app/docs/...` 308-redirects to the
  docs host, so each page has one public URL. `/sitemap.xml` and `/robots.txt`
  on the docs host come from `src/app/docs/sitemap.ts` and
  `src/app/docs/robots.txt/route.ts`. `sosial.app/developers` redirects to
  the docs' REST API page.
- **Links in**: the site nav's Resources menu and the footer's Resources
  column link to the docs (the footer's Channels and Developers links moved
  into the docs as pages).

## Going live (one time)

1. **Apply the three docs migrations** to the database production uses, in
   order: `20261028120000_p111_docs.sql` (tables, access rules, starter pages),
   `20261028130000_p112_docs_channels_developers.sql` (Channels and
   Developers sections) and `20261028140000_p113_docs_icons_channel_pages.sql`
   (page icons, sub-pages, one page per channel under "OAuth Channels", the
   changelog). Run each file on its own; don't use
   `supabase db push`, because the remote history is missing older migrations
   and a push would re-run them. On the self-hosted stack (`infra/SERVER.md`):
   `scp` the files to the VPS, then
   `docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < file.sql`,
   then `notify pgrst, 'reload schema';`.
2. **Add the domain in Vercel**: project `sosial-web` → Settings → Domains →
   Add `docs.sosial.app`, assigned to the Production environment (no redirect).
3. **DNS** in Cloudflare (zone `sosial.app`), the record Vercel asks for,
   normally:

   | Type  | Name | Target                 | Proxy status          |
   | ----- | ---- | ---------------------- | --------------------- |
   | CNAME | docs | `cname.vercel-dns.com` | DNS only (grey cloud) |

   Keep it **DNS only**: the zone default is proxied (orange), and a proxied
   record stops Vercel from issuing and renewing the certificate. Use the exact
   target Vercel shows if it differs (it sometimes gives a project-specific
   `*.vercel-dns-0xx.com` name).
4. Wait for Vercel to show the domain as **Valid Configuration** and the
   certificate as issued, then open `https://docs.sosial.app`.
5. Optional env (Vercel → Environment Variables): `NEXT_PUBLIC_DOCS_URL`
   overrides the docs origin used for canonical URLs, the sitemap and the
   `/docs` redirect. It defaults to `https://docs.sosial.app`, so production
   needs nothing. Leave it unset on preview deployments.
6. Submit `https://docs.sosial.app/sitemap.xml` in Google Search Console as a
   new property (the docs host is a separate site to Google).

## Local development

Browsers resolve `*.localhost` to your machine, so no hosts-file edit is
needed:

- `npm run dev` in `apps/web`, then open `http://docs.localhost:3000`.
- Set `NEXT_PUBLIC_DOCS_URL=http://docs.localhost:3000` in `.env.local` so the
  site nav, footer and MCP links point at your local docs instead of
  production.
- `http://localhost:3000/docs` redirects there too.
- Edit pages at `http://localhost:3000/admin/docs` while signed in as an app
  admin (a row in `app_admins`).

Command-line tools may not resolve `docs.localhost`; send the header instead:
`curl -H "Host: docs.localhost:3000" http://localhost:3000/`.
