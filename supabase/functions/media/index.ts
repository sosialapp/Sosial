// media · direct-to-R2 upload lifecycle + presign for the Sosial apps.
//
// Replaces r2-presign. Media never passes through Supabase Storage or Vercel:
// the browser/native app uploads straight to Cloudflare R2 with short-lived
// presigned URLs. This function only ever sees JSON metadata.
//
// POST { action: ... }  (Authorization: Bearer <user JWT>)
//   init        { workspaceId, kind, filename, size, mimeType?, width?, height?,
//                 durationMs?, thumb?{filename,size,mimeType} }
//                 → { mediaId, key, upload:{ mode, url? , uploadId?, partSize?,
//                     totalParts? }, thumbUpload? }
//   sign-parts  { mediaId, partNumbers:[n,...] } → { urls:[{partNumber,url}] }
//   complete    { mediaId, parts?:[{partNumber,etag}] } → { mediaId, status }
//   abort       { mediaId } → { ok:true }
//   list-parts  { mediaId } → { parts:[{partNumber,etag,size}] }
//   get         { path, bucket?, expiresIn?, filename? } → { url }
//   sign        { items:[{path,bucket?}], expiresIn? } → { urls:[] }
//   delete      { mediaId } → { ok:true }
//   public      { path, bucket? } → { url }   (blog-media, app-admin only)
//
// 200 · 400 bad input · 401 not signed in · 403 not allowed · 413 too big
//     · 409 conflict · 500 misconfigured · 502 upstream (R2) failure
//
// Object keys: post-media/<MEDIA_ENV>/<workspace_id>/<media_id>/<safe_filename>
// Private (presigned). blog-media/<path> is public and app-admin-only.
// Secrets: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// R2_BUCKET (default sosial-media), R2_PUBLIC_URL, MEDIA_ENV (default prod).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

const BUCKETS = new Set(["post-media", "blog-media"]);
const GET_MAX = 7 * 24 * 3600; // Dev.to article images are fetched days later
const PUT_MAX = 3600;

// Product media rules (mirror apps/web/src/lib/mediaLimits.ts).
const IMAGE_MAX = 10 * 1024 * 1024; // 10 MB
const VIDEO_MAX = 10 * 1024 * 1024 * 1024; // 10 GB (the YouTube ceiling)
const MULTIPART_OVER = 100 * 1024 * 1024; // ≤100 MB → single PUT
const MIN_PART = 8 * 1024 * 1024; // R2 minimum part is 5 MiB
const MAX_PARTS = 1000; // target; hard cap stays under R2's 10,000

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

/** Reject anything that could escape the bucket prefix or break the signature. */
function validPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.length > 0 &&
    path.length <= 512 &&
    !path.startsWith("/") &&
    !path.includes("..") &&
    !path.includes("\\") &&
    !path.includes("//")
  );
}

/** A URL-safe filename: no slashes, no control chars, capped length. */
function safeName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "");
  return (cleaned || "file").slice(0, 120);
}

/** Dynamic part size so the count stays ≤ MAX_PARTS at MIN_PART granularity. */
function partSizeFor(total: number): number {
  const raw = Math.max(MIN_PART, Math.ceil(total / MAX_PARTS));
  // Round up to the next MiB for tidier parts.
  const mib = 1024 * 1024;
  return Math.ceil(raw / mib) * mib;
}

/** Sniff a media type from its leading bytes (image + video containers). */
function sniffMediaType(bytes: Uint8Array): "image" | "video" | null {
  const u = bytes;
  if (u.length >= 3 && u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return "image"; // JPEG
  if (u.length >= 8 && u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return "image"; // PNG
  if (u.length >= 6 && u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46) return "image"; // GIF
  if (
    u.length >= 12 && u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46 &&
    u[8] === 0x57 && u[9] === 0x45 && u[10] === 0x42 && u[11] === 0x50
  ) return "image"; // WEBP
  if (u.length >= 4 && u[0] === 0x1a && u[1] === 0x45 && u[2] === 0xdf && u[3] === 0xa3) return "video"; // EBML/WebM-MKV
  if (u.length >= 12 && u[4] === 0x66 && u[5] === 0x74 && u[6] === 0x79 && u[7] === 0x70) return "video"; // ISO-BMFF ftyp (mp4/mov)
  return null;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  const accountId = Deno.env.get("R2_ACCOUNT_ID") ?? "";
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") ?? "";
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "";
  const r2Bucket = Deno.env.get("R2_BUCKET") ?? "sosial-media";
  const publicBase = (Deno.env.get("R2_PUBLIC_URL") ?? "").replace(/\/+$/, "");
  const mediaEnv = (Deno.env.get("MEDIA_ENV") ?? "prod").replace(/[^\w-]/g, "") || "prod";
  if (!supaUrl || !anonKey || !serviceKey) return bad("Function misconfigured — missing Supabase env.", 500);
  if (!accountId || !accessKeyId || !secretAccessKey) {
    return bad("Function misconfigured — missing R2 env.", 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Body must be JSON.");
  }
  const action = body["action"];

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return bad("Sign in first.", 401);
  const bearer = authHeader.slice(7).trim();
  // Trusted server callers (the public API route) authenticate with the
  // service_role key and name the acting user in `userId`. Everyone else is a
  // normal user JWT whose identity we read from the token itself.
  const isService = bearer === serviceKey;

  const userClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  let userId: string;
  if (isService) {
    userId = String(body["userId"] ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return bad("Service calls must include a valid userId.");
  } else {
    const { data: ud, error: uErr } = await userClient.auth.getUser();
    if (uErr || !ud?.user) return bad("Sign in first.", 401);
    userId = ud.user.id;
  }

  // Service-role client: status transitions have no RLS update policy, and
  // writes are authorized explicitly by the checks below.
  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  // URL path layout: <endpoint>/<real bucket>/<logical prefix>/<path>. The
  // first path segment is the BUCKET NAME to R2 — the logical bucket
  // (post-media/blog-media) is a prefix inside R2_BUCKET, never the bucket.
  const objectUrl = (bucket: string, path: string) => `${endpoint}/${r2Bucket}/${bucket}/${path}`;

  const expiresIn = (v: unknown, max: number) => {
    const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : 0;
    return n > 0 ? Math.min(n, max) : 0;
  };

  const signPresigned = async (
    method: "GET" | "PUT",
    bucket: string,
    path: string,
    contentType: string,
    ttl: number,
    extraQuery: Record<string, string> = {},
  ) => {
    const u = new URL(objectUrl(bucket, path));
    u.searchParams.set("X-Amz-Expires", String(ttl));
    for (const [k, v] of Object.entries(extraQuery)) u.searchParams.set(k, v);
    const headers: Record<string, string> = {};
    if (method === "PUT" && contentType) headers["content-type"] = contentType;
    const signed = await aws.sign(new Request(u.toString(), { method, headers }), {
      aws: { signQuery: true, allHeaders: method === "PUT" },
    });
    return signed.url;
  };

  /** Confirm the caller is an active member of a workspace. */
  const isMember = async (workspaceId: string) => {
    const { data } = await admin
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    return !!data;
  };

  const isAdmin = async () => {
    const { data } = await userClient.rpc("is_app_admin");
    return !!data;
  };

  try {
    /* ----------------------------------------------------------- init --- */
    if (action === "init") {
      const workspaceId = String(body["workspaceId"] ?? "");
      const kindRaw = String(body["kind"] ?? "");
      const filename = String(body["filename"] ?? "");
      const size = Number(body["size"] ?? 0);
      if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return bad("workspaceId required.");
      if (kindRaw !== "image" && kindRaw !== "video") return bad("kind must be image or video.");
      if (!filename || !Number.isFinite(size) || size <= 0) return bad("filename and size required.");
      const cap = kindRaw === "image" ? IMAGE_MAX : VIDEO_MAX;
      if (size > cap) {
        return bad(
          kindRaw === "image" ? "Images are limited to 10 MB." : "Videos are limited to 10 GB.",
          413,
        );
      }
      if (!(await isMember(workspaceId))) return bad("Not a member of this workspace.", 403);

      // Plan storage quota: reject when this upload would exceed the cap.
      const { data: used } = await admin.rpc("workspace_storage_used", { p_workspace_id: workspaceId });
      const { data: limit } = await admin.rpc("workspace_storage_limit", { p_workspace_id: workspaceId });
      if (typeof limit === "number" && typeof used === "number" && used + size > limit) {
        return bad("Not enough storage left on this plan.", 413);
      }

      const mediaId = crypto.randomUUID();
      // storage_path has NO bucket prefix (the bucket travels alongside it, as
      // with legacy rows): <env>/<workspace_id>/<media_id>/<filename>.
      const storagePath = `${mediaEnv}/${workspaceId}/${mediaId}/${safeName(filename)}`;
      const objectKey = `post-media/${storagePath}`;

      const thumbIn = body["thumb"] as Record<string, unknown> | undefined;
      const thumbPath = thumbIn && thumbIn["filename"]
        ? `${mediaEnv}/${workspaceId}/${mediaId}/thumb-${safeName(String(thumbIn["filename"]))}`
        : null;

      const { error: insErr } = await admin.from("media_assets").insert({
        id: mediaId,
        workspace_id: workspaceId,
        uploaded_by: userId,
        storage_path: storagePath,
        storage_backend: "r2",
        kind: kindRaw,
        mime_type: body["mimeType"] ? String(body["mimeType"]) : null,
        byte_size: size,
        width: typeof body["width"] === "number" ? body["width"] : null,
        height: typeof body["height"] === "number" ? body["height"] : null,
        duration_ms: typeof body["durationMs"] === "number" ? body["durationMs"] : null,
        original_filename: filename.slice(0, 255),
        thumb_path: thumbPath,
        status: "uploading",
      });
      if (insErr) return bad(`Could not create media row: ${insErr.message}`, 500);

      const contentType = String(body["mimeType"] ?? "application/octet-stream");

      if (size <= MULTIPART_OVER) {
        const url = await signPresigned("PUT", "post-media", storagePath, contentType, PUT_MAX);
        let thumbUpload: { key: string; url: string } | null = null;
        if (thumbPath) {
          const tUrl = await signPresigned("PUT", "post-media", thumbPath, "image/webp", PUT_MAX);
          thumbUpload = { key: thumbPath, url: tUrl };
        }
        return Response.json(
          { mediaId, key: objectKey, upload: { mode: "single", url }, thumbUpload },
          { headers: CORS },
        );
      }

      // Multipart: open the upload and hand back the part size.
      const partSize = partSizeFor(size);
      const totalParts = Math.ceil(size / partSize);
      const createRes = await aws.fetch(`${objectUrl("post-media", storagePath)}?uploads`, {
        method: "POST",
        headers: { "content-type": contentType },
      });
      if (!createRes.ok) return bad(`R2 create upload failed (${createRes.status}).`, 502);
      const xml = await createRes.text();
      const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(xml)?.[1];
      if (!uploadId) return bad("R2 did not return an UploadId.", 502);

      await admin.from("media_assets").update({ upload_id: uploadId }).eq("id", mediaId);
      await admin.from("media_uploads").insert({
        media_id: mediaId,
        workspace_id: workspaceId,
        upload_id: uploadId,
        part_size: partSize,
        total_parts: totalParts,
      });

      let thumbUpload: { key: string; url: string } | null = null;
      if (thumbPath) {
        const tUrl = await signPresigned("PUT", "post-media", thumbPath, "image/webp", PUT_MAX);
        thumbUpload = { key: thumbPath, url: tUrl };
      }
      return Response.json(
        { mediaId, key: objectKey, upload: { mode: "multipart", uploadId, partSize, totalParts }, thumbUpload },
        { headers: CORS },
      );
    }

    /* ---------------------------------------------------- sign-parts --- */
    if (action === "sign-parts") {
      const mediaId = String(body["mediaId"] ?? "");
      const numbers = Array.isArray(body["partNumbers"]) ? body["partNumbers"] : [];
      if (!mediaId || numbers.length === 0 || numbers.length > 100) {
        return bad("mediaId and 1–100 partNumbers required.");
      }
      const { data: asset } = await admin
        .from("media_assets").select("id,workspace_id,storage_path,upload_id,status").eq("id", mediaId).maybeSingle();
      if (!asset) return bad("Unknown media.", 404);
      if (!(await isMember(asset.workspace_id))) return bad("Not a member of this workspace.", 403);
      if (asset.status !== "uploading" || !asset.upload_id) return bad("Upload is not in progress.", 409);
      const storagePath = String(asset.storage_path);
      const urls = await Promise.all(
        numbers.map(async (n) => {
          const partNumber = Math.floor(Number(n));
          const url = await signPresigned("PUT", "post-media", storagePath, "", PUT_MAX, {
            partNumber: String(partNumber),
            uploadId: String(asset.upload_id),
          });
          return { partNumber, url };
        }),
      );
      return Response.json({ urls }, { headers: CORS });
    }

    /* ------------------------------------------------------ complete --- */
    if (action === "complete") {
      const mediaId = String(body["mediaId"] ?? "");
      if (!mediaId) return bad("mediaId required.");
      const { data: asset } = await admin
        .from("media_assets").select("id,workspace_id,storage_path,upload_id,status,kind").eq("id", mediaId).maybeSingle();
      if (!asset) return bad("Unknown media.", 404);
      if (!(await isMember(asset.workspace_id))) return bad("Not a member of this workspace.", 403);
      if (asset.status === "ready") return Response.json({ mediaId, status: "ready" }, { headers: CORS }); // idempotent

      const storagePath = String(asset.storage_path);
      const { data: upload } = await admin
        .from("media_uploads").select("upload_id,total_parts,parts").eq("media_id", mediaId).maybeSingle();

      if (upload) {
        const parts = Array.isArray(body["parts"]) && body["parts"].length
          ? (body["parts"] as Record<string, unknown>[])
          : (upload.parts as Record<string, unknown>[]);
        if (!parts || parts.length !== upload.total_parts) return bad("Not all parts uploaded.", 409);
        const xmlParts = parts
          .slice()
          .sort((a, b) => Number(a["partNumber"]) - Number(b["partNumber"]))
          .map((p) => {
            // ETags must match the part PUT response exactly; S3/R2 expect the
            // quotes, so normalize whether or not the client kept them.
            const rawEtag = String(p["etag"]).replace(/^"|"$/g, "");
            const etag = `&quot;${rawEtag.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}&quot;`;
            return `<Part><PartNumber>${Number(p["partNumber"])}</PartNumber><ETag>${etag}</ETag></Part>`;
          })
          .join("");
        const completeXml = `<CompleteMultipartUpload>${xmlParts}</CompleteMultipartUpload>`;
        const cRes = await aws.fetch(`${objectUrl("post-media", storagePath)}?uploadId=${encodeURIComponent(String(upload.upload_id))}`, {
          method: "POST",
          headers: { "content-type": "application/xml" },
          body: completeXml,
        });
        if (!cRes.ok) return bad(`R2 complete failed (${cRes.status}).`, 502);
        await admin.from("media_uploads").delete().eq("media_id", mediaId);
      } else if (!asset.upload_id) {
        // single PUT path — nothing to complete server-side
      } else {
        return bad("Upload session not found.", 409);
      }

      // Verify the object that actually landed: size match + signature sniff.
      const head = await aws.fetch(objectUrl("post-media", storagePath), { method: "HEAD" });
      if (!head.ok) return bad("Uploaded object not found in storage.", 409);
      const landed = Number(head.headers.get("content-length") ?? 0);
      const { data: row } = await admin.from("media_assets").select("byte_size,kind").eq("id", mediaId).single();
      if (row && landed > 0 && Math.abs(landed - Number(row.byte_size)) > 1024) {
        await admin.from("media_assets").update({ status: "failed" }).eq("id", mediaId);
        return bad("Uploaded size does not match — try again.", 409);
      }
      const range = await aws.fetch(objectUrl("post-media", storagePath), { headers: { range: "bytes=0-31" } });
      if (range.ok) {
        const sniffed = sniffMediaType(new Uint8Array(await range.arrayBuffer()));
        if (row && sniffed && sniffed !== row.kind) {
          await admin.from("media_assets").update({ status: "failed" }).eq("id", mediaId);
          return bad(`File does not look like a valid ${row.kind}.`, 409);
        }
      }

      await admin.from("media_assets")
        .update({ status: "ready", byte_size: landed > 0 ? landed : undefined })
        .eq("id", mediaId);
      return Response.json({ mediaId, status: "ready" }, { headers: CORS });
    }

    /* --------------------------------------------------------- abort --- */
    if (action === "abort") {
      const mediaId = String(body["mediaId"] ?? "");
      if (!mediaId) return bad("mediaId required.");
      const { data: asset } = await admin
        .from("media_assets").select("id,workspace_id,storage_path,upload_id").eq("id", mediaId).maybeSingle();
      if (!asset) return Response.json({ ok: true }, { headers: CORS });
      if (!(await isMember(asset.workspace_id))) return bad("Not a member of this workspace.", 403);
      if (asset.upload_id) {
        const storagePath = String(asset.storage_path);
        await aws.fetch(
          `${objectUrl("post-media", storagePath)}?uploadId=${encodeURIComponent(String(asset.upload_id))}`,
          { method: "DELETE" },
        ).catch(() => {});
      }
      await admin.from("media_uploads").delete().eq("media_id", mediaId);
      await admin.from("media_assets").update({ status: "deleted" }).eq("id", mediaId);
      return Response.json({ ok: true }, { headers: CORS });
    }

    /* ---------------------------------------------------- list-parts --- */
    if (action === "list-parts") {
      const mediaId = String(body["mediaId"] ?? "");
      if (!mediaId) return bad("mediaId required.");
      const { data: asset } = await admin
        .from("media_assets").select("workspace_id,upload_id").eq("id", mediaId).maybeSingle();
      if (!asset) return bad("Unknown media.", 404);
      if (!(await isMember(asset.workspace_id))) return bad("Not a member of this workspace.", 403);
      const { data: upload } = await admin.from("media_uploads").select("parts").eq("media_id", mediaId).maybeSingle();
      return Response.json({ parts: upload?.parts ?? [] }, { headers: CORS });
    }

    /* ----------------------------------------------------------- get --- */
    if (action === "get" || action === "sign") {
      const items = action === "sign"
        ? (Array.isArray(body["items"]) ? body["items"] : [])
        : [{ path: body["path"], bucket: body["bucket"] }];
      if (items.length === 0 || items.length > 100) return bad("1–100 items required.");
      const clean: { bucket: string; path: string }[] = [];
      for (const it of items) {
        const bucket = String((it as Record<string, unknown>)["bucket"] ?? "post-media");
        const path = (it as Record<string, unknown>)["path"];
        if (!BUCKETS.has(bucket) || !validPath(path)) return bad("Invalid path.");
        // post-media paths are workspace-scoped. New keys are
        // <env>/<workspace_id>/...; legacy keys are <workspace_id>/... — so
        // take the first uuid-looking segment as the workspace id.
        if (bucket === "post-media") {
          const ws = String(path).split("/").find((seg) => /^[0-9a-f-]{36}$/i.test(seg)) ?? "";
          if (!ws || !(await isMember(ws))) {
            return bad("Not a member of this workspace.", 403);
          }
        } else if (!(await isAdmin())) {
          return bad("App admins only.", 403);
        }
        clean.push({ bucket, path });
      }
      const ttl = expiresIn(body["expiresIn"], GET_MAX) || 3600;
      const urls = await Promise.all(
        clean.map((it) => signPresigned("GET", it.bucket, it.path, "", ttl)),
      );
      if (action === "get") {
        const url = urls[0];
        const filename = body["filename"] ? String(body["filename"]) : "";
        return Response.json(
          { url: filename ? `${url}&response-content-disposition=${encodeURIComponent(`attachment; filename="${safeName(filename)}"`)}` : url, expiresIn: ttl },
          { headers: CORS },
        );
      }
      return Response.json({ urls, expiresIn: ttl }, { headers: CORS });
    }

    /* -------------------------------------------------------- delete --- */
    if (action === "delete") {
      const mediaId = String(body["mediaId"] ?? "");
      if (!mediaId) return bad("mediaId required.");
      const { data: asset } = await admin
        .from("media_assets").select("id,workspace_id,uploaded_by,storage_path,thumb_path,upload_id")
        .eq("id", mediaId).maybeSingle();
      if (!asset) return Response.json({ ok: true }, { headers: CORS });
      const member = await isMember(asset.workspace_id);
      const { data: role } = await userClient.rpc("workspace_role", { w_id: asset.workspace_id });
      const mayDelete = member && (asset.uploaded_by === userId || role === "owner" || role === "admin");
      if (!mayDelete) return bad("Only the uploader or a workspace admin may delete media.", 403);

      if (asset.upload_id) {
        const storagePath = String(asset.storage_path);
        await aws.fetch(
          `${objectUrl("post-media", storagePath)}?uploadId=${encodeURIComponent(String(asset.upload_id))}`,
          { method: "DELETE" },
        ).catch(() => {});
      } else {
        for (const p of [asset.storage_path, asset.thumb_path]) {
          if (!p) continue;
          await aws.fetch(objectUrl("post-media", String(p)), { method: "DELETE" }).catch(() => {});
        }
      }
      await admin.from("media_uploads").delete().eq("media_id", mediaId);
      await admin.from("media_assets").update({ status: "deleted" }).eq("id", mediaId);
      return Response.json({ ok: true }, { headers: CORS });
    }

    /* -------------------------------------------------------- public --- */
    if (action === "public") {
      const bucket = String(body["bucket"] ?? "blog-media");
      const path = body["path"];
      if (!BUCKETS.has(bucket) || !validPath(path)) return bad("Invalid path.");
      if (bucket !== "blog-media") return bad("Only blog-media is public.");
      if (!publicBase) return bad("Function misconfigured — missing R2_PUBLIC_URL.", 500);
      if (!(await isAdmin())) return bad("App admins only.", 403);
      return Response.json({ url: `${publicBase}/${bucket}/${path}` }, { headers: CORS });
    }

    /* --------------------------------------------- legacy put (compat) -- */
    // Kept so any un-migrated caller can still get a one-off presigned PUT.
    if (action === "put") {
      const bucket = String(body["bucket"] ?? "");
      const path = body["path"];
      if (!BUCKETS.has(bucket)) return bad("Unknown bucket.");
      if (!validPath(path)) return bad("Invalid path.");
      if (bucket === "post-media") {
        const ws = String(path).split("/").find((seg) => /^[0-9a-f-]{36}$/i.test(seg)) ?? "";
        if (!ws || !(await isMember(ws))) return bad("Not a member of this workspace.", 403);
      } else if (!(await isAdmin())) {
        return bad("App admins only.", 403);
      }
      const ttl = expiresIn(body["expiresIn"], PUT_MAX) || PUT_MAX;
      const url = await signPresigned("PUT", bucket, path, String(body["contentType"] ?? "application/octet-stream"), ttl);
      return Response.json({ url, key: `${bucket}/${path}`, expiresIn: ttl }, { headers: CORS });
    }

    return bad("Unknown action.");
  } catch (e) {
    return bad(`Media request failed: ${e instanceof Error ? e.message : String(e)}`, 502);
  }
});
