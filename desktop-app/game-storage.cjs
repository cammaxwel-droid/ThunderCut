const fs = require('node:fs');
const path = require('node:path');
const FILE_NAME = 'game-transaction-v1.json';
const MAX_BYTES = 1024 * 1024;

function validValue(value) {
  if (value === null) return true;
  if (typeof value !== 'string' || Buffer.byteLength(value) > MAX_BYTES) return false;
  try {
    const transaction = JSON.parse(value);
    return (transaction?.version === 2 || transaction?.version === 3)
      && Number.isFinite(transaction.savedAt);
  } catch { return false; }
}

function createTransactionStore(directory, io = fs) {
  const file = path.join(directory, FILE_NAME);
  const temporary = file + '.tmp';
  function read() {
    try {
      if (io.statSync(file).size > MAX_BYTES * 2) return { ok: false };
      const record = JSON.parse(io.readFileSync(file, 'utf8'));
      if (record?.format !== 1 || !validValue(record.value)) return { ok: false };
      return { ok: true, found: true, value: record.value };
    } catch (error) {
      return error.code === 'ENOENT' ? { ok: true, found: false, value: null } : { ok: false };
    }
  }
  function write(value) {
    if (!validValue(value) || !read().ok) return false;
    let descriptor;
    try {
      io.mkdirSync(directory, { recursive: true });
      descriptor = io.openSync(temporary, 'w', 0o600);
      io.writeFileSync(descriptor, JSON.stringify({ format: 1, value }), 'utf8');
      // Acknowledge only after the complete replacement has reached disk.
      io.fsyncSync(descriptor);
      io.closeSync(descriptor);
      descriptor = undefined;
      io.renameSync(temporary, file);
      return true;
    } catch {
      if (descriptor !== undefined) { try { io.closeSync(descriptor); } catch {} }
      return false;
    }
  }
  return { read, write };
}

function registerTransactionIpc(ipcMain, store, isAuthorized) {
  ipcMain.on('thunder-cut:transaction:read', event => {
    event.returnValue = isAuthorized(event) ? store.read() : { ok: false };
  });
  ipcMain.on('thunder-cut:transaction:write', (event, value) => {
    event.returnValue = isAuthorized(event) && store.write(value);
  });
}

module.exports = { createTransactionStore, registerTransactionIpc, FILE_NAME };
