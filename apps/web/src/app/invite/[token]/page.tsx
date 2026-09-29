import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Card({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-sm p-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
          <Image src="/bolt.png" alt="Sosial" width={44} height={44} />
        </div>
        <h1 className="font-display text-xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        <div className="mt-5">{action}</div>
      </div>
    </main>
  );
}

/** Team invite landing: signed-out users get the sign-in card (with a return
 *  trip); signed-in users hand off to the redeem route, which accepts the
 *  token, remembers the workspace in a cookie, and lands them in the team. */
export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;

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

  if (sp?.err) {
    return (
      <Card
        title="Could not accept this invite"
        body={sp.err}
        action={
          <Link href="/calendar" className="btn btn-ghost w-full">
            Back to calendar
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

  redirect(`/api/invite/${token}`);
}
