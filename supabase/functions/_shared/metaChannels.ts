// _shared/metaChannels.ts · which channels a Meta signed_request names.
//
// Deauthorize and data-deletion callbacks carry one app-scoped user id, and
// each provider keeps it in a different place:
//   threads    external_id IS the app-scoped user id
//   instagram  external_id is the /me id; the token exchange's user_id is
//              kept as metadata.meta_user_id (either may be the one Meta sends)
//   facebook   external_id is a Page id; the login's user id rides along as
//              metadata.meta_user_id (Pages connected before p114 lack it and
//              cannot be resolved from a signature alone)

// deno-lint-ignore no-explicit-any
type Admin = any;

export interface MetaChannel {
  id: string;
  workspace_id: string;
}

export async function metaChannelsForUser(admin: Admin, userId: string): Promise<MetaChannel[]> {
  // Meta ids are numeric; anything else would break out of the filter string.
  if (!/^\d+$/.test(userId)) return [];
  const { data, error } = await admin
    .from("connected_channels")
    .select("id, workspace_id")
    .in("provider", ["threads", "instagram", "facebook"])
    .or(
      `and(provider.in.(threads,instagram),external_id.eq.${userId}),metadata->>meta_user_id.eq.${userId}`,
    );
  if (error) throw new Error(error.message);
  return (data ?? []) as MetaChannel[];
}
