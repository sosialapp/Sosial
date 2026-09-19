export type ProviderKey =
  | 'facebook'
  | 'instagram'
  | 'threads'
  | 'tiktok'
  | 'x'
  | 'bluesky'
  | 'linkedin'
  | 'mastodon'
  | 'pinterest'
  | 'youtube';

export type PostStatus =
  | 'draft'
  | 'approval'
  | 'queued'
  | 'publishing'
  | 'sent'
  | 'partial'
  | 'failed';

export type TargetStatus =
  | 'pending'
  | 'needs_approval'
  | 'queued'
  | 'publishing'
  | 'sent'
  | 'failed'
  | 'skipped';

export type ChannelStatus = 'connected' | 'expired' | 'revoked' | 'error';

export interface ConnectedChannel {
  id: string;
  workspace_id: string;
  provider: ProviderKey;
  external_id: string;
  display_name: string | null;
  handle: string | null;
  instance_url: string | null;
  status: ChannelStatus;
  metadata: Record<string, unknown>;
}

export interface PostTargetRow {
  id: string;
  post_id: string;
  channel_id: string;
  provider: ProviderKey;
  format: string | null;
  caption: string | null;
  options: Record<string, unknown>;
  status: TargetStatus;
  scheduled_at: string | null;
  remote_id: string | null;
  remote_url: string | null;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  idempotency_key: string;
}

export interface MediaAssetRow {
  id: string;
  workspace_id: string;
  storage_path: string;
  kind: 'image' | 'video';
  mime_type: string | null;
  byte_size: number | null;
  status: 'uploading' | 'ready' | 'failed';
  signed_url?: string;
}

export interface PostMediaRow {
  post_id: string;
  media_id: string;
  position: number;
  media_assets: MediaAssetRow | null;
}

export type ApprovalStatus = 'pending' | 'approved' | 'changes_requested';

export interface ApprovalRow {
  id: string;
  post_id: string;
  status: ApprovalStatus;
  comment: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface PostRow {
  id: string;
  workspace_id: string;
  created_by: string | null;
  client_id: string | null;
  title: string;
  body: string;
  status: PostStatus;
  scheduled_at: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
}

export interface PostWithTargets extends PostRow {
  post_targets: PostTargetRow[];
  post_media: PostMediaRow[];
  approvals?: ApprovalRow[];
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
}
