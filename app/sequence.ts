export class SequenceCancelledError extends Error {
  constructor() {
    super('Visual sequence cancelled');
    this.name = 'SequenceCancelledError';
  }
}

/**
 * Owns every timeout used by a visual sequence so a mode change, new result,
 * hidden window or unmount can cancel the entire chain in one operation.
 */
export class VisualSequenceController {
  private generation = 0;
  private timers = new Map<number, () => void>();

  begin() {
    this.cancel();
    return this.generation;
  }

  isCurrent(token: number) {
    return token === this.generation;
  }

  async wait(token: number, milliseconds: number) {
    if (!this.isCurrent(token)) throw new SequenceCancelledError();
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.timers.delete(timer);
        if (this.isCurrent(token)) resolve();
        else reject(new SequenceCancelledError());
      }, milliseconds);
      this.timers.set(timer, () => reject(new SequenceCancelledError()));
    });
  }

  cancel() {
    this.generation += 1;
    this.timers.forEach((reject, timer) => {
      window.clearTimeout(timer);
      reject();
    });
    this.timers.clear();
  }
}
