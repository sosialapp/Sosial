/**
 * The worker sets metadata.commentsBlocked when a token was granted without a
 * comments scope. The channel stays `connected`, because publishing and stats
 * still work, but only a new sign-in can add the scope.
 */
export function commentsBlocked(metadata: unknown): boolean {
  return !!metadata && typeof metadata === 'object' && (metadata as { commentsBlocked?: unknown }).commentsBlocked === true;
}

/**
 * Connecting the same live account twice is a no-op with a name, so the
 * callback skips the import. Expired, revoked and error rows import so a
 * reconnect heals them, and so does a blocked row, whose new token is the fix.
 */
export function skipTokenImport(existing: { status?: string; metadata?: unknown } | null | undefined): boolean {
  return existing?.status === 'connected' && !commentsBlocked(existing.metadata);
}
