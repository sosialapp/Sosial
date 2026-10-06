import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Delete your data',
  description:
    'How to request export or deletion of your Sosial data: what is removed, how long it takes, and where to ask.',
  alternates: { canonical: '/delete-data' },
};

/**
 * Standalone data-deletion instructions. Linked from the privacy policy's
 * deletion bullet — and the URL Meta's app dashboard wants for the Data
 * Deletion Request field. States the process plainly: what, how, how long.
 */
export default function DeleteDataPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 md:py-24">
      <p className="eyebrow">Privacy</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Delete your data</h1>
      <p className="mt-5 text-lg leading-relaxed text-muted">
        You own your content. Export it or delete it any time — here is exactly how.
      </p>

      <hr className="my-10 border-line" />

      <div className="space-y-10">
        <section>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Delete it yourself, instantly</h2>
          <div className="prose-sosial mt-3">
            <p>
              No email needed: open{' '}
              <Link href="/profile" className="font-bold text-accent-ink underline underline-offset-2">
                Profile settings
              </Link>{' '}
              (or Account on the mobile app), tap <strong>Delete my data</strong>, confirm you
              understand what goes away, then type <strong>confirm</strong>. Your account,
              workspaces, posts, media, channels and tokens are erased immediately and you are
              signed out.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Prefer email?</h2>
          <div className="prose-sosial mt-3">
            <p>
              Email{' '}
              <a
                href="mailto:support@sosial.app?subject=Data%20deletion%20request"
                className="font-bold text-accent-ink underline underline-offset-2"
              >
                support@sosial.app
              </a>{' '}
              from your account email with the subject “Data deletion request”. Tell us whether you
              want an export first, a deletion, or both.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold tracking-tight">What gets removed</h2>
          <div className="prose-sosial mt-3">
            <ul>
              <li>Your workspace, posts, drafts, ideas and scheduled queue.</li>
              <li>Connected social accounts and their stored tokens.</li>
              <li>Uploaded media and generated images.</li>
              <li>Your profile details and notification settings.</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold tracking-tight">How long it takes</h2>
          <div className="prose-sosial mt-3">
            <p>
              Self-serve deletions in Profile settings complete immediately. Email requests:
              exports go out within 7 days, deletions within 30 days of your confirmed
              request. A few records may be kept briefly where the law requires it (tax, fraud
              prevention, security logs) — never your content.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-extrabold tracking-tight">Disconnect first (optional)</h2>
          <div className="prose-sosial mt-3">
            <p>
              Removing a social account from the Channels page revokes Sosial&apos;s access
              immediately. Already-published posts stay on the networks — delete those on each
              network itself.
            </p>
          </div>
        </section>
      </div>

      <p className="mt-12 text-sm text-muted">
        Prefer reading the full policy first?{' '}
        <Link href="/privacy" className="font-bold text-accent-ink underline underline-offset-2">
          Privacy Policy
        </Link>
      </p>
    </article>
  );
}
