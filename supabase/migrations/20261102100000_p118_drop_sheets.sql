-- P118 · Remove the Google Sheets content source (added in P51).
--
-- The import flow, routes and sheets-auth edge function are gone, so drop
-- what they kept: the per-workspace Google tokens (Vault secrets first, so
-- nothing is orphaned), the import jobs, and the 'sheets' provenance rows in
-- post_sources. Imported posts themselves are kept. post_sources goes back to
-- Notion only, and the Bulk import guide (P117) loses its Sheets section
-- unless an admin has already rewritten it.

delete from vault.secrets s
using public.sheets_connections c
where s.id in (c.access_secret_id, c.refresh_secret_id);

drop table if exists public.sheets_connections;
drop table if exists public.sheets_imports;

delete from public.post_sources where source_type = 'sheets';

alter table public.post_sources drop constraint if exists post_sources_source_type_check;
alter table public.post_sources
  add constraint post_sources_source_type_check check (source_type in ('notion'));

update public.docs_pages
set
  description = 'Turn a Notion database into drafts and scheduled posts, validated row by row before anything is created.',
  body_md = $md$Bulk import turns a content calendar you already keep in Notion into posts. Each row becomes a draft or a scheduled post, and every row is checked before anything is created.

## Where to find it

Open **Post** and pick the **Import** tab.

## Import from Notion

1. Select **Connect Notion** and choose which databases Sosial may read.
2. Pick a database. If it isn't listed, open it in Notion, then **•••** → **Connections** → add **Sosial**.
3. Map the fields. **Content** is required and can be a text property or the page body. You can also map a title, platform (a select whose values map to your channels), status, publish date, files and tags.
4. Check the preview and import.

Property types Sosial can't use (people, relations, rollups) are skipped with a warning. A select value you haven't mapped is flagged as an error, never guessed.

## Rows that need attention

A row isn't imported when it has no content, a platform that doesn't match a connected channel (or matches more than one), a date that can't be read or is in the past, or a status that says scheduled but has no date. The report gives the row number and the reason.

Some problems are warnings and the row still imports: media that isn't an `https://` link is left out, a status value you haven't mapped imports as a draft, and text over a channel's limit is flagged so you can shorten it in the composer.

## Importing again

Re-importing the same database skips rows that are already in Sosial, and counts rows that changed in Notion since the last import. Disconnecting Notion keeps the posts you imported.
$md$
where slug = 'bulk-import'
  and description = 'Turn a Google Sheet or a Notion database into drafts and scheduled posts, validated row by row before anything is created.';
