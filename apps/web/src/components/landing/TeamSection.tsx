/**
 * Team section (Tenner parents architecture): ink band, control rows with
 * color icon discs left, static parent-style phone right (approve card +
 * toggles). Copy is the existing accurate approvals text.
 */

function Ico({ bg, fg = '#1C1A14', children }: { bg: string; fg?: string; children: React.ReactNode }) {
  return (
    <span className="grid h-11 w-11 flex-none place-items-center rounded-xl" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

const CONTROLS: { title: string; body: string; bg: string; fg?: string; icon: React.ReactNode }[] = [
  {
    title: 'Approval workflow',
    body: 'Members send posts for review instead of publishing. Nothing ships unreviewed.',
    bg: '#FFC62E',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /><path d="M9 12l2 2 4-4" /></svg>
    ),
  },
  {
    title: 'Channel roles',
    body: 'Limit each person to the channels they actually run. Owners and admins decide.',
    bg: '#D7E8F2',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
    ),
  },
  {
    title: 'Member requests',
    body: 'Every request lands in one queue with the post attached. Approve in one tap or send a note back.',
    bg: '#FDF3D7',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]"><rect x="3" y="6" width="18" height="12" rx="3" /><path d="M3 10h18" /></svg>
    ),
  },
  {
    title: 'One-tap decide',
    body: 'Approved posts join the queue at their slot. Sent-back posts return with your comment.',
    bg: '#FFC62E',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" /></svg>
    ),
  },
];

function ApprovePhone() {
  return (
    <div className="mx-auto w-60 rounded-[2.6rem] bg-[#0E181C] p-2 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]">
      <div className="overflow-hidden rounded-[2rem] bg-white px-4 pt-3 pb-4 text-[#1C1A14]">
        <div className="mx-auto h-1.5 w-16 rounded-full bg-ink/10" />
        <p className="mt-3 text-xs font-medium text-muted">Owner view · approval</p>
        <p className="font-display text-2xl font-semibold">2 waiting</p>
        <div className="mt-3 rounded-2xl border-[1.5px] border-ink/10 p-3">
          <p className="text-[13px] font-semibold">Maya asked to publish</p>
          <p className="mt-0.5 text-xs text-muted">Launch teaser · Threads · 9:00 AM</p>
          <div className="mt-2.5 flex gap-2">
            <span className="flex-1 rounded-[10px] bg-bolt py-2 text-center text-xs font-bold">Approve</span>
            <span className="flex-1 rounded-[10px] border-[1.5px] border-ink py-2 text-center text-xs font-bold">Not now</span>
          </div>
        </div>
        <p className="mt-3 mb-1 text-[11px] font-semibold text-muted">Workspace</p>
        {[
          ['Auto-post queue', true],
          ['Weekend posting', false],
          ['AI drafts for members', true],
        ].map(([label, on]) => (
          <div key={label as string} className="flex items-center justify-between border-t border-ink/10 py-2.5 text-[13px] font-medium">
            <span>{label}</span>
            <span className={`relative h-[22px] w-10 flex-none rounded-full ${on ? 'bg-ink' : 'bg-ink/15'}`}>
              <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white ${on ? 'right-[3px]' : 'left-[3px]'}`} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
              <div key={c.title} className="grid grid-cols-[44px_1fr] items-start gap-3.5 rounded-[18px] border-[1.5px] border-paper/15 bg-paper/[0.06] p-4">
                <Ico bg={c.bg} fg={c.fg}>{c.icon}</Ico>
                <div>
                  <h3 className="font-display text-[17px] font-semibold">{c.title}</h3>
                  <p className="mt-1 text-sm text-paper/70">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="justify-self-center" aria-label="Approval phone mock">
          <ApprovePhone />
        </div>
      </div>
    </section>
  );
}
