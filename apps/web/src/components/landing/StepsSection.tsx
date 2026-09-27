import Link from 'next/link';

/**
 * Steps (Tenner open-account architecture): four numbered cards with color
 * number blocks and who-pills, plus a CTA foot. All four moves are real
 * product flows.
 */

const STEPS: { who: string; n: string; bg: string; title: string; body: string }[] = [
  {
    who: 'Creator',
    n: '1',
    bg: '#D7E8F2',
    title: 'Connect your channels',
    body: 'Link the networks you post to. Each connects through its official API in about a minute.',
  },
  {
    who: 'Creator',
    n: '2',
    bg: '#FDF3D7',
    title: 'Compose once',
    body: 'Write one caption, preview it natively on every channel, let the AI draft when you are blank.',
  },
  {
    who: 'Team',
    n: '3',
    bg: '#FFC62E',
    title: 'Approve as a team',
    body: 'Members send posts for review. Owners approve in one tap or send a note back.',
  },
  {
    who: 'Auto',
    n: '4',
    bg: '#1C1A14',
    title: 'The queue ships',
    body: 'Scheduled posts publish on time while the app is closed. Results land back in the queue.',
  },
];

export default function StepsSection() {
  return (
    <section aria-label="How it works" className="bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
        <div className="max-w-[34ch]">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-2 font-display text-3xl leading-[1.12] font-semibold tracking-tight md:text-4xl">
            From idea to posted in four moves.
          </h2>
          <p className="mt-3 text-muted">
            Set up once in an evening. Then it is just writing and approving.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="relative rounded-[28px] border border-line bg-white p-6 pb-7">
              <span className="absolute top-5 right-5 rounded-full border-[1.5px] border-ink bg-white px-2.5 py-1 text-xs font-semibold">
                {s.who}
              </span>
              <span
                className="grid h-14 w-14 place-items-center rounded-2xl font-display text-3xl font-bold"
                style={{ background: s.bg, color: s.bg === '#1C1A14' ? '#FFF7E8' : '#1C1A14' }}
                aria-hidden="true"
              >
                {s.n}
              </span>
              <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 text-[15px] text-muted">
          <Link
            href="/login"
            className="inline-flex items-center gap-2.5 rounded-full border-2 border-ink bg-bolt px-6 py-3.5 font-display text-base font-semibold text-ink transition-all hover:-translate-y-0.5"
          >
            Start scheduling free
          </Link>
          <span>Free plan · iOS, Android and web.</span>
        </div>
      </div>
    </section>
  );
}
