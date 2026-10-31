import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const { createTransactionStore, registerTransactionIpc, FILE_NAME } = createRequire(import.meta.url)('../desktop-app/game-storage.cjs');
const value = amount => JSON.stringify({ version: 3, savedAt: Date.now(), pendingWin: amount });
const directory = () => fs.mkdtempSync(path.join(os.tmpdir(), 'thunder-cut-save-test-'));

test('desktop journal migrates an absent save and survives reopening', () => {
  const dir=directory(), store=createTransactionStore(dir), win=value(24000);
  assert.deepEqual(store.read(), { ok:true, found:false, value:null });
  assert.equal(store.write(win), true);
  assert.deepEqual(createTransactionStore(dir).read(), { ok:true, found:true, value:win });
});
test('a failed disk flush never replaces the last accepted win', () => {
  const dir=directory(), previous=value(300), next=value(600);
  assert.equal(createTransactionStore(dir).write(previous), true);
  const faulty=createTransactionStore(dir, { ...fs, fsyncSync(){ throw Error('Simulated disk failure'); } });
  assert.equal(faulty.write(next), false);
  assert.equal(createTransactionStore(dir).read().value, previous);
  assert.equal(createTransactionStore(dir).write(next), true);
  assert.equal(createTransactionStore(dir).read().value, next);
});
test('an interrupted temporary write does not hide the accepted transaction', () => {
  const dir=directory(), previous=value(7500), store=createTransactionStore(dir);
  assert.equal(store.write(previous), true);
  fs.writeFileSync(path.join(dir,FILE_NAME+'.tmp'), '{partial');
  assert.equal(createTransactionStore(dir).read().value, previous);
});
test('ending a session writes a durable empty record rather than reviving an old save', () => {
  const dir=directory(), store=createTransactionStore(dir);
  assert.equal(store.write(value(1800)), true);
  assert.equal(store.write(null), true);
  assert.deepEqual(createTransactionStore(dir).read(), {ok:true,found:true,value:null});
});
test('invalid inputs and a damaged existing save fail closed', () => {
  const dir=directory(), store=createTransactionStore(dir), prior=value(600);
  assert.equal(store.write(prior), true);
  for (const bad of ['invalid', '{}', '{"version":3}', 123, 'x'.repeat(1024*1024+1)]) assert.equal(store.write(bad), false);
  assert.equal(store.read().value, prior);
  fs.writeFileSync(path.join(dir,FILE_NAME), '{damaged');
  assert.deepEqual(store.read(), {ok:false});
  assert.equal(store.write(value(0)), false);
  assert.equal(fs.readFileSync(path.join(dir,FILE_NAME),'utf8'), '{damaged');
});
test('only the authorized game renderer can use save IPC', () => {
  const bus=new EventEmitter(),store=createTransactionStore(directory());
  registerTransactionIpc(bus,store,event=>event.authorized===true);
  const read={},write={};bus.emit('thunder-cut:transaction:read',read);bus.emit('thunder-cut:transaction:write',write,value(99));
  assert.deepEqual(read.returnValue,{ok:false});assert.equal(write.returnValue,false);assert.equal(store.read().found,false);
  const accepted={authorized:true};bus.emit('thunder-cut:transaction:write',accepted,value(99));assert.equal(accepted.returnValue,true);
});
