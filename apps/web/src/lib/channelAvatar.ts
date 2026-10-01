/**
 * Avatar URL tucked into channel metadata by the avatar sync (may be absent).
 * Pure helper — lives here (not in ChannelAvatar.tsx) so Server Components
 * can call it; that file is 'use client' for its image onError fallback.
 */
export function channelAvatar(
  metadata: Record<string, unknown> | null | undefined,
): string | undefined {
  const v = metadata?.avatar;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
