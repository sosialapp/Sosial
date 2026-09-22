import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Card({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-sm p-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-2xl font-extrabold text-white">
          S
        </div>
        <h1 className="font-display text-xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        <div className="mt-5">{action}</div>
      </div>
    </main>
  );
}

/** Team invite redeem: signed-in user claims the token, then lands in the app. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!UUID.test(token)) {
    return (
      <Card
        title="This invite link is broken"
        body="Ask your teammate to send a fresh invite. Links expire after 7 days."
        action={
          <Link href="/login" className="btn btn-ghost w-full">
            Go to sign in
          </Link>
        }
      />
    );
  }

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return (
      <Card
        title="You have been invited to Sosial"
        body="Sign in (or create an account) with the invited email address to join the workspace."
        action={
          <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="btn btn-primary w-full">
            Sign in to accept
          </Link>
        }
      />
    );
  }

  const { error } = await sb.rpc('accept_invite', { p_token: token });
  if (!error || /already accepted/i.test(String(error?.message ?? ''))) redirect('/calendar');

  return (
    <Card
      title="Could not accept this invite"
      body={String(error?.message ?? 'The invite is invalid or expired. Ask for a fresh one.')}
      action={
        <Link href="/calendar" className="btn btn-ghost w-full">
          Back to calendar
        </Link>
      }
    />
  );
}
