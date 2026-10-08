export function ts(): string {
  return new Date().toISOString();
}

/**
 * Routine per-job chatter is gated behind WORKER_DEBUG so the steady state
 * stays quiet — Log Ingestion is a metered free-tier resource and a busy queue
 * can otherwise flood it. Errors and warnings ALWAYS log (see `warn`/`err`).
 */
const DEBUG = /^(1|true|yes|on)$/i.test(process?.env?.WORKER_DEBUG ?? '');

export function debug(...a: any[]): void {
  if (DEBUG) console.log(`[${ts()}]`, ...a);
}

export function info(...a: any[]): void {
  console.log(`[${ts()}]`, ...a);
}

export function warn(...a: any[]): void {
  console.warn(`[${ts()}] WARN`, ...a);
}

export function err(...a: any[]): void {
  console.error(`[${ts()}] ERROR`, ...a);
}
