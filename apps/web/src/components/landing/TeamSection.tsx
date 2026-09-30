/**
 * Team section (Tenner parents architecture): ink band, control rows with
 * copy left, SVG iPhone render (real app screenshot on screen) right. Copy
 * is the existing accurate approvals text.
 */
import Image from 'next/image';

const CONTROLS: { title: string; body: string }[] = [
  {
    title: 'Approval workflow',
    body: 'Members send posts for review instead of publishing. Nothing ships unreviewed.',
  },
  {
    title: 'Channel roles',
    body: 'Limit each person to the channels they actually run. Owners and admins decide.',
  },
  {
    title: 'Member requests',
    body: 'Every request lands in one queue with the post attached. Approve in one tap or send a note back.',
  },
  {
    title: 'One-tap decide',
    body: 'Approved posts join the queue at their slot. Sent-back posts return with your comment.',
  },
];

export default function TeamSection() {
  return (
    <section aria-label="Approvals and roles" className="bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-20 md:py-28 lg:grid-cols-2">
        <div>
          <p className="eyebrow !text-paper/60">Approvals and roles</p>
          <h2 className="mt-2 font-display text-3xl leading-[1.12] font-semibold tracking-tight md:text-4xl">
            Nothing ships unreviewed.
          </h2>
          <p className="mt-3 max-w-[52ch] text-paper/75">
            Teammates draft, you decide. Roles, requests and one-tap approvals live in the
            same calendar as everything else.
          </p>
          <div className="mt-8 grid gap-3">
            {CONTROLS.map((c) => (
              <div key={c.title} className="rounded-[18px] border-[1.5px] border-paper/15 bg-paper/[0.06] p-4">
                <h3 className="font-display text-[17px] font-semibold">{c.title}</h3>
                <p className="mt-1 text-sm text-paper/70">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="justify-self-center" aria-label="Sosial app on iPhone">
          <Image
            src="/team-phone.png"
            alt=""
            width={400}
            height={826}
            loading="lazy"
            unoptimized
            className="h-auto w-72 [filter:drop-shadow(0_30px_60px_rgba(0,0,0,0.5))] sm:w-96"
          />
        </div>
      </div>
    </section>
  );
}
