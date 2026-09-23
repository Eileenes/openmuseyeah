/**
 * Decides when a recording should upload what it has buffered.
 *
 * Progressive recognition re-reads the whole utterance on every update, so push
 * cadence is a straight cost/latency trade-off: pushing every fragment feels
 * snappier and bills for far more requests. Encoding that rule here — pure, with
 * an injectable clock — keeps it testable without a microphone.
 */
export interface PushSchedulerOptions {
  /** Never push more often than this. */
  minIntervalMs?: number;
  /** Never push for less audio than this; very small clips waste a request. */
  minBytes?: number;
}

export interface PushScheduler {
  /** Records newly captured audio and reports whether it is time to upload. */
  offer(bytes: number, now?: number): boolean;
  /** Audio captured but not yet uploaded. */
  pending(): number;
  /** Reports whether anything is waiting; used for the final flush. */
  hasPending(): boolean;
  /** Clears the buffer without pushing, for a cancelled recording. */
  reset(): void;
}

export function createPushScheduler(options: PushSchedulerOptions = {}): PushScheduler {
  const minIntervalMs = options.minIntervalMs ?? 1200;
  const minBytes = options.minBytes ?? 4096;
  let pending = 0;
  let lastPushAt = Number.NEGATIVE_INFINITY;

  return {
    offer(bytes, now = Date.now()) {
      if (bytes > 0) pending += bytes;
      if (pending < minBytes) return false;
      // The first push is never throttled: the person is waiting for text.
      if (lastPushAt !== Number.NEGATIVE_INFINITY && now - lastPushAt < minIntervalMs) return false;
      pending = 0;
      lastPushAt = now;
      return true;
    },
    pending: () => pending,
    hasPending: () => pending > 0,
    reset() {
      pending = 0;
      lastPushAt = Number.NEGATIVE_INFINITY;
    },
  };
}
