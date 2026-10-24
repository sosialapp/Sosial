/**
 * Main loop: claim -> dispatch -> complete, forever.
 *
 * A small pool of slots runs jobs in parallel so one slow provider call no
 * longer parks every other channel, and the claim poll is short (1s by
 * default) so a queued publish, reply or DM starts almost immediately.
 * Errors -> short sleep, loop never dies (Railway restarts on crash; the loop
 * surviving transient outages matters more than exiting loudly).
 */
import { env, required } from './env';
import { initDb, claimJob, completeJob, Job } from './db';
import { dispatch } from './dispatch';
import { info, warn, err, debug } from './logger';

declare const process: any;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Reject when a dispatch overruns. The provider call keeps running in the
 *  background, but the slot moves on instead of starving the queue. */
function withTimeout(p: Promise<void>, ms: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`job timed out after ${Math.round(ms / 1000)}s`)),
      ms,
    );
    p.then(
      () => {
        clearTimeout(t);
        resolve();
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function main(): Promise<void> {
  initDb();
  // Fail fast when pointed at the wrong project, service key is per-project.
  required('WORKER_SERVICE_ROLE_KEY');
  const workerId = `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  // Empty-queue wait. This is the floor on how fast a queued post, reply or
  // message starts, so it is deliberately short; each poll is one tiny RPC.
  const pollMs = Number(env('WORKER_POLL_MS', '1000')) || 1000;
  const errorMs = Number(env('WORKER_ERROR_MS', '15000')) || 15000;
  // Ceiling for one job. Publish/media jobs are allowed to be slow, sync and
  // refresh jobs are pure JSON and must never hold a slot hostage.
  const jobMs = Number(env('WORKER_JOB_TIMEOUT_MS', '120000')) || 120000;
  // Parallel jobs. Enough for a media publish plus the sync sweep and a
  // user-facing reply at the same time.
  const concurrency = Math.max(1, Number(env('WORKER_CONCURRENCY', '4')) || 4);
  let stopped = false;
  let inFlight = 0;
  try {
    process?.on?.('SIGTERM', () => { stopped = true; });
    process?.on?.('SIGINT', () => { stopped = true; });
  } catch { /* non-Node runtimes: loop runs until killed */ }

  info(
    `worker ${workerId} up (poll ${pollMs}ms, concurrency ${concurrency}, ` +
      `job timeout ${Math.round(jobMs / 1000)}s)`,
  );

  const run = (job: Job): void => {
    inFlight++;
    void (async () => {
      try {
        await withTimeout(dispatch(job), jobMs);
        await completeJob(job.id, true);
        debug(`job ${job.id} done`);
      } catch (e: any) {
        const msg = String(e?.message ?? e ?? 'job failed');
        warn(`job ${job.id} failed: ${msg}`);
        try {
          await completeJob(job.id, false, msg);
        } catch (e2: any) {
          err(`job ${job.id}: could not record failure: ${String(e2?.message ?? e2)}`);
        }
      } finally {
        inFlight--;
      }
    })();
  };

  while (!stopped) {
    // All slots busy: wait for one to free up instead of piling up claims.
    if (inFlight >= concurrency) {
      await sleep(25);
      continue;
    }
    try {
      const job = await claimJob(workerId);
      if (!job) {
        await sleep(pollMs);
        continue;
      }
      info(`claimed job ${job.id} kind=${job.kind} attempt=${job.attempts}/${job.max_attempts}`);
      run(job);
    } catch (e: any) {
      err(`loop error: ${String(e?.message ?? e)}`);
      await sleep(errorMs);
    }
  }

  // Drain: let in-flight jobs record their result before the container dies.
  const deadline = Date.now() + 25_000;
  while (inFlight > 0 && Date.now() < deadline) await sleep(100);
  info(`worker ${workerId} stopping`);
}

main().catch((e) => {
  err(`fatal: ${String(e?.message ?? e)}`);
  try { process?.exit?.(1); } catch { /* noop */ }
});
