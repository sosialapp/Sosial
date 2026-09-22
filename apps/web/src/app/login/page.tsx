import LoginForm from '@/components/LoginForm';
import ThemeScope from '@/components/ThemeScope';
import { oauthErrorMessage } from '@/lib/auth';
import { hasSupabaseEnv } from '@/lib/supabase/server';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  return (
    <ThemeScope>
      <main className="flex min-h-screen items-center justify-center bg-bone p-6 text-ink">
      {hasSupabaseEnv() ? (
        <LoginForm externalError={oauthErrorMessage(error)} next={next} />
      ) : (
        <div className="card max-w-md p-6">
          <p className="eyebrow mb-3">Setup needed</p>
          <h1 className="font-display text-xl font-extrabold">Connect the backend first</h1>
          <p className="mt-2 text-sm text-soft">
            Add the same Supabase project the mobile app uses to{' '}
            <code className="rounded bg-surface px-1.5 py-0.5 text-xs">apps/web/.env.local</code>:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-ink p-3 text-xs text-white">
            {`NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000`}
          </pre>
          <p className="mt-3 text-xs text-muted">Then restart the dev server.</p>
        </div>
      )}
      </main>
    </ThemeScope>
  );
}
