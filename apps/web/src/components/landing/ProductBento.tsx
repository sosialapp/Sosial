'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { BRAND_NAMES, BrandIcon, type BrandProvider } from '@/components/BrandIcon';
import { useT } from '@/lib/i18n/client';
import { landingMessages } from '@/lib/i18n/landing';

/**
 * Create / Publish / Team in one bento. Every card is a small working demo
 * on local state (nothing is sent anywhere): pick a tone and generate,
 * pick channels and schedule, flip through the week, approve or send back
 * a teammate's post. Demo copy is sample content, so it stays in English.
 */

type Area = 'create' | 'publish' | 'team';

const AREA_TINT: Record<Area, string> = {
  create: 'bg-[#FCE4EF] text-[#B0246F]',
  publish: 'bg-[#DDEFFD] text-[#1D6FB8]',
  team: 'bg-[#FFF0C2] text-[#8A5A00]',
};

function Card({
  area,
  label,
  title,
  body,
  stage,
  className = '',
  children,
}: {
  area: Area;
  label: string;
  title: string;
  body: string;
  stage: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article className={`flex flex-col overflow-hidden rounded-[28px] bg-[#F5F5F3] p-2 ${className}`}>
      <div className="px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
        <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${AREA_TINT[area]}`}>{label}</span>
        <h3 className="mt-3 font-display text-xl font-[700] tracking-[-0.02em] sm:text-2xl">{title}</h3>
        <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-ink/55">{body}</p>
      </div>
      <div className={`relative flex flex-1 items-center justify-center rounded-[22px] p-4 sm:p-8 ${stage}`}>{children}</div>
    </article>
  );
}

const panel = 'w-full rounded-2xl bg-white shadow-[0_24px_60px_-28px_rgba(28,26,20,0.4)] ring-1 ring-black/5';

/* ------------------------------ AI writer ----------------------------- */

const TONES = {
  Punchy: 'v2 is live. Faster drafts, smarter queue, zero busywork. Go try it 👇',
  Story: 'Six months ago our queue broke at 3am. Today we shipped the fix, and a lot more. Here is v2 🧵',
  Friendly: 'Hey friends! v2 just landed and we think you’ll love how much quicker posting feels ✨',
  Thread: '1/ We shipped v2 today. Three things we learned the hard way, and one we’d do again tomorrow.',
} as const;
type Tone = keyof typeof TONES;

function WriterDemo() {
  const [tone, setTone] = useState<Tone>('Punchy');
  const [phase, setPhase] = useState<'idle' | 'busy' | 'typing'>('idle');
  const [out, setOut] = useState<string>(TONES.Punchy);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const generate = (next: Tone) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setTone(next);
    setPhase('busy');
    const text = TONES[next];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOut(text);
      setPhase('idle');
      return;
    }
    timers.current.push(
      setTimeout(() => {
        setPhase('typing');
        for (let i = 1; i <= text.length; i++) {
          timers.current.push(setTimeout(() => setOut(text.slice(0, i)), i * 14));
        }
        timers.current.push(setTimeout(() => setPhase('idle'), text.length * 14 + 50));
      }, 650),
    );
  };

  return (
    <div className={`${panel} max-w-[460px] p-4`}>
      <div className="rounded-xl bg-[#F5F5F3] px-3.5 py-3 text-[13px] text-ink/70">Turn my launch notes into a post.</div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tone">
        {(Object.keys(TONES) as Tone[]).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tone === t}
            onClick={() => generate(t)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
              tone === t ? 'bg-ink text-paper' : 'bg-[#F3F3F1] text-ink/65 hover:bg-[#E9E9E6]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-3 min-h-[92px] rounded-xl border border-line p-3.5" aria-live="polite">
        <div className="flex items-center gap-2">
          <BrandIcon provider="threads" className="h-4 w-4" />
          <span className="text-[12px] font-medium">sosial.app</span>
          <span className="text-[11px] text-ink/40">· Preview</span>
        </div>
        {phase === 'busy' ? (
          <div className="mt-3 space-y-2" aria-label="Writing">
            <div className="h-2.5 w-11/12 animate-pulse rounded-full bg-[#EDEDEA]" />
            <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-[#EDEDEA]" />
          </div>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-ink/80">{out}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => generate(tone)}
        disabled={phase !== 'idle'}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-[10px] bg-bolt py-2.5 text-[13px] font-medium text-on-accent transition hover:bg-bolt-deep disabled:opacity-70"
      >
        {phase === 'idle' ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor">
            <path d="M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10Z" />
          </svg>
        ) : (
          <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
        )}
        {phase === 'idle' ? 'Generate again' : 'Writing…'}
      </button>
    </div>
  );
}

/* ------------------------------ scheduler ----------------------------- */

const PICKABLE: BrandProvider[] = ['instagram', 'tiktok', 'x', 'threads', 'youtube', 'bluesky', 'facebook'];

function ScheduleDemo() {
  const [picked, setPicked] = useState<BrandProvider[]>(['instagram', 'tiktok', 'threads']);
  const [state, setState] = useState<'edit' | 'busy' | 'done'>('edit');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const toggle = (p: BrandProvider) =>
    setPicked((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const schedule = () => {
    setState('busy');
    timer.current = setTimeout(() => setState('done'), 900);
  };

  if (state === 'done') {
    return (
      <div className={`${panel} max-w-[340px] p-5 text-center`} aria-live="polite">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#2f8f5b] text-white">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-5 w-5" fill="none">
            <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="mt-3 font-display text-[15px] font-medium">Scheduled for Wed, 12:00</p>
        <div className="mt-2 flex justify-center gap-1">
          {picked.map((p) => (
            <BrandIcon key={p} provider={p} className="h-4 w-4" />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setState('edit')}
          className="mt-4 rounded-[10px] bg-[#F3F3F1] px-4 py-2 text-[12px] font-medium text-ink/70 transition hover:bg-[#E9E9E6]"
        >
          Schedule another
        </button>
      </div>
    );
  }

  return (
    <div className={`${panel} max-w-[340px] p-4`}>
      <p className="text-[12px] font-medium text-ink/50">Post to</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {PICKABLE.map((p) => {
          const on = picked.includes(p);
          return (
            <button
              key={p}
              type="button"
              aria-pressed={on}
              aria-label={BRAND_NAMES[p]}
              onClick={() => toggle(p)}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                on ? 'bg-white ring-2 ring-ink' : 'bg-[#F3F3F1] opacity-50 hover:opacity-80'
              }`}
            >
              <BrandIcon provider={p} className="h-4 w-4" />
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] font-medium">
        <span className="rounded-lg bg-[#F3F3F1] px-3 py-2">Wed, 12:00</span>
        <span className="rounded-lg bg-[#F3F3F1] px-3 py-2">New York</span>
      </div>
      <button
        type="button"
        onClick={schedule}
        disabled={picked.length === 0 || state === 'busy'}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-[10px] bg-ink py-2.5 text-[13px] font-medium text-paper transition hover:bg-[#2a261d] disabled:opacity-50"
      >
        {state === 'busy' && (
          <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        )}
        {picked.length === 0 ? 'Pick a channel' : `Schedule to ${picked.length} channel${picked.length > 1 ? 's' : ''}`}
      </button>
    </div>
  );
}

/* -------------------------------- week -------------------------------- */

const WEEK: { day: string; posts: { at: string; p: BrandProvider; title: string }[] }[] = [
  { day: 'Mon', posts: [{ at: '09:00', p: 'instagram', title: 'Spring drop teaser' }, { at: '17:30', p: 'x', title: 'Launch thread' }] },
  { day: 'Tue', posts: [{ at: '11:00', p: 'tiktok', title: 'Behind the scenes' }] },
  {
    day: 'Wed',
    posts: [
      { at: '08:15', p: 'threads', title: 'Morning hook' },
      { at: '12:00', p: 'youtube', title: 'Product walkthrough' },
      { at: '19:00', p: 'instagram', title: 'Customer story' },
    ],
  },
  { day: 'Thu', posts: [{ at: '10:30', p: 'bluesky', title: 'Changelog notes' }] },
  { day: 'Fri', posts: [{ at: '09:45', p: 'facebook', title: 'Weekend offer' }, { at: '16:00', p: 'pinterest', title: 'Moodboard pin' }] },
];

function WeekDemo() {
  const [day, setDay] = useState(2);
  return (
    <div className={`${panel} max-w-[380px] p-4`}>
      <div className="grid grid-cols-5 gap-1.5" role="tablist" aria-label="Day">
        {WEEK.map((d, i) => (
          <button
            key={d.day}
            type="button"
            role="tab"
            aria-selected={day === i}
            onClick={() => setDay(i)}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[12px] font-medium transition ${
              day === i ? 'bg-ink text-paper' : 'bg-[#F5F5F3] text-ink/60 hover:bg-[#ECECE9]'
            }`}
          >
            {d.day}
            <span className="flex gap-0.5">
              {d.posts.map((x) => (
                <span key={x.at} className={`h-1 w-1 rounded-full ${day === i ? 'bg-bolt' : 'bg-ink/30'}`} />
              ))}
            </span>
          </button>
        ))}
      </div>
      <ul className="mt-3 flex min-h-[156px] flex-col gap-1.5" role="tabpanel">
        {WEEK[day].posts.map((x) => (
          <li key={x.at} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
            <BrandIcon provider={x.p} className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{x.title}</span>
            <span className="text-[12px] text-ink/45">{x.at}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------ approvals ----------------------------- */

const REQUESTS = [
  { who: 'Leo', img: 'men/32', p: 'instagram' as BrandProvider, text: 'Spring drop is live. Tap the link for early access before Friday.' },
  { who: 'Maya', img: 'women/44', p: 'tiktok' as BrandProvider, text: 'POV: you finally scheduled a whole week before Monday coffee.' },
  { who: 'Sam', img: 'men/75', p: 'x' as BrandProvider, text: 'We are hiring a community lead. DMs open, links in bio.' },
];

function ApprovalDemo() {
  const [i, setI] = useState(0);
  const [verdict, setVerdict] = useState<null | 'approved' | 'sent-back'>(null);
  const r = REQUESTS[i];
  const next = () => {
    setVerdict(null);
    setI((n) => (n + 1) % REQUESTS.length);
  };
  return (
    <div className="flex w-full max-w-[640px] flex-col items-center gap-4 sm:flex-row sm:items-stretch">
      <div className={`${panel} p-4 sm:flex-1`} aria-live="polite">
        <div className="flex items-center gap-2.5">
          <Image
            src={`https://randomuser.me/api/portraits/${r.img}.jpg`}
            alt=""
            width={64}
            height={64}
            className="h-8 w-8 rounded-full object-cover"
          />
          <p className="min-w-0 flex-1 text-[13px] leading-snug">
            <span className="font-medium">{r.who}</span> <span className="text-ink/55">sent a post for review</span>
          </p>
          <BrandIcon provider={r.p} className="h-4 w-4" />
        </div>
        <div className="mt-3 rounded-xl bg-[#F6F6F4] p-3 text-[13px] leading-relaxed text-ink/75">{r.text}</div>
        {verdict === null ? (
          <div className="mt-3 grid grid-cols-2 gap-2 text-[13px] font-medium">
            <button
              type="button"
              onClick={() => setVerdict('approved')}
              className="rounded-[10px] bg-ink py-2.5 text-paper transition hover:bg-[#2a261d]"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setVerdict('sent-back')}
              className="rounded-[10px] bg-[#F3F3F1] py-2.5 text-ink/70 transition hover:bg-[#E9E9E6]"
            >
              Send back
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-[10px] bg-[#F6F6F4] px-3 py-2.5">
            <span className="flex items-center gap-2 text-[13px] font-medium">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full ${
                  verdict === 'approved' ? 'bg-bolt text-ink' : 'bg-[#F2683C] text-white'
                }`}
              >
                {verdict === 'approved' ? '✓' : '↩'}
              </span>
              {verdict === 'approved' ? 'Approved, joins the queue Fri 09:00' : `Sent back to ${r.who} with a note`}
            </span>
            <button type="button" onClick={next} className="shrink-0 text-[12px] font-medium text-ink/50 underline hover:text-ink">
              Next
            </button>
          </div>
        )}
      </div>

      <div className={`${panel} p-4 sm:w-[200px]`}>
        <p className="text-[12px] font-medium text-ink/50">Review queue</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {REQUESTS.map((x, n) => (
            <li
              key={x.who}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] ${n === i ? 'bg-accent-soft font-medium' : 'text-ink/55'}`}
            >
              <BrandIcon provider={x.p} className="h-3.5 w-3.5" />
              {x.who}
              {n < i || (n === i && verdict) ? <span className="ml-auto text-ink/40">done</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------- grid -------------------------------- */

export default function ProductBento() {
  const t = useT(landingMessages);
  return (
    <section id="features" aria-label={t('navFeatures')} className="scroll-mt-16 bg-white">
      <div className="mx-auto max-w-6xl px-4 pb-2 pt-20 md:pt-28">
        <h2 className="max-w-3xl font-display text-3xl font-[700] leading-[1.1] tracking-[-0.03em] text-balance sm:text-5xl">
          {t('lpBentoBig')}{' '}
          <span className="bg-[linear-gradient(90deg,#F2A400,#F2683C_55%,#D6249F)] bg-clip-text text-transparent">
            {t('lpBentoHl')}
          </span>
        </h2>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink/55 sm:text-base">{t('lpBentoTry')}</p>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-12">
          <Card
            area="create"
            label={t('lpNavCreate')}
            title={t('lpCr1t')}
            body={t('lpCr1d')}
            stage="bg-[linear-gradient(120deg,#FFD9C4_0%,#F7D0E6_50%,#DCCDFF_100%)]"
            className="md:col-span-7"
          >
            <WriterDemo />
          </Card>
          <Card
            area="publish"
            label={t('lpNavPublish')}
            title={t('lpPb1t')}
            body={t('lpPb1d')}
            stage="bg-[linear-gradient(140deg,#B7D9FF_0%,#BDEEDA_100%)]"
            className="md:col-span-5"
          >
            <ScheduleDemo />
          </Card>
          <Card
            area="publish"
            label={t('lpNavPublish')}
            title={t('lpPb3t')}
            body={t('lpPb3d')}
            stage="bg-[linear-gradient(140deg,#DDE4FF_0%,#C9E6FF_100%)]"
            className="md:col-span-5"
          >
            <WeekDemo />
          </Card>
          <Card
            area="team"
            label={t('lpNavTeam')}
            title={t('t1t')}
            body={t('t3d')}
            stage="bg-[linear-gradient(120deg,#FFF0B5_0%,#FFD7BC_100%)]"
            className="md:col-span-7"
          >
            <ApprovalDemo />
          </Card>
        </div>
      </div>
    </section>
  );
}
