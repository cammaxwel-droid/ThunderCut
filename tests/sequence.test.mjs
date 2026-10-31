import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = {
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
};

const { SequenceCancelledError, VisualSequenceController } = await import('../app/sequence.ts');

test('a new sequence cancels every pending continuation from the old one', async () => {
  const controller = new VisualSequenceController();
  const first = controller.begin();
  const pending = controller.wait(first, 50);
  const second = controller.begin();
  assert.equal(controller.isCurrent(first), false);
  assert.equal(controller.isCurrent(second), true);
  await assert.rejects(pending, SequenceCancelledError);
});

test('current sequence waits resolve normally', async () => {
  const controller = new VisualSequenceController();
  const token = controller.begin();
  await controller.wait(token, 1);
  assert.equal(controller.isCurrent(token), true);
});

