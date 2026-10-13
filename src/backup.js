import { useSyncExternalStore } from "react";
import { loadState, normalizeState, isStateEmpty, onStateSaved } from "./storage.js";

// Browsers wipe localStorage/IndexedDB/caches together when the user clears site
// data, so the only copy that survives lives outside the browser: a JSON file the
// user picks once (File System Access API) that we rewrite after every change.
// The handle to that file is kept in IndexedDB. If the data is wiped the handle goes
// with it, but the file stays on the device and can be restored from.

const BACKUP_APP_ID = "meu-saldo";
const BACKUP_VERSION = 1;
const SUGGESTED_NAME = "meu-saldo-backup.json";
const FILE_TYPES = [{ description: "Backup do Meu Saldo", accept: { "application/json": [".json"] } }];
const WRITE_DEBOUNCE_MS = 400;

const DB_NAME = "meu-saldo-backup";
const DB_STORE = "handles";
const HANDLE_KEY = "file";

const LAST_MANUAL_KEY = "meu-saldo:last-manual-backup";
const NUDGE_DISMISSED_KEY = "meu-saldo:backup-nudge-dismissed";

const SUPPORTED = typeof window !== "undefined" && "showSaveFilePicker" in window;

// status: "unsupported" | "off" | "active" | "needs-permission" | "restore-available" | "error"
const initialSnapshot = {
  supported: SUPPORTED,
  status: SUPPORTED ? "off" : "unsupported",
  fileName: null,
  lastWriteAt: null,
  error: null,
  restoreCandidate: null, // { entries, exportedAt } — what the linked file holds
  persisted: null, // whether the browser promised not to evict our storage
};

let snapshot = initialSnapshot;
const subscribers = new Set();

let handle = null;
let candidateState = null;
// Safety net against clobbering a good backup with an empty app: if the app started
// with no data and the linked file has some, we ask before the first write.
let startedEmpty = false;
let reconciled = false;

let timer = null;
let writing = false;
let dirty = false;

function setSnapshot(patch) {
  snapshot = { ...snapshot, ...patch };
  for (const fn of subscribers) fn();
}

function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function useBackup() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

// --- IndexedDB (only holds the file handle) ---

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb(mode, run) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, mode);
      const request = run(tx.objectStore(DB_STORE));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const loadHandle = () => idb("readonly", (store) => store.get(HANDLE_KEY));
const saveHandle = (value) => idb("readwrite", (store) => store.put(value, HANDLE_KEY));
const forgetHandle = () => idb("readwrite", (store) => store.delete(HANDLE_KEY));

// --- Backup file format ---

function isValidEntry(item) {
  return item && typeof item === "object" && typeof item.id === "string" && Number.isFinite(item.value);
}

export function buildBackup(state) {
  return { app: BACKUP_APP_ID, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), state };
}

// Throws an Error with a user-facing message when the text isn't a usable backup.
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Esse arquivo não é um backup do Meu Saldo.");
  }
  if (!data || data.app !== BACKUP_APP_ID || !data.state || typeof data.state !== "object") {
    throw new Error("Esse arquivo não é um backup do Meu Saldo.");
  }
  if (!Number.isFinite(data.version) || data.version > BACKUP_VERSION) {
    throw new Error("Esse backup vem de uma versão mais nova do app. Atualize o Meu Saldo e tente de novo.");
  }
  const { incomes, expenses, recurring } = data.state;
  const lists = [incomes, expenses, recurring ?? []];
  if (!lists.every((list) => Array.isArray(list) && list.every(isValidEntry))) {
    throw new Error("O arquivo de backup está corrompido.");
  }
  return { state: normalizeState(data.state), exportedAt: data.exportedAt ?? null };
}

export function countEntries(state) {
  return state.incomes.length + state.expenses.length;
}

export function entriesLabel(count) {
  return `${count} ${count === 1 ? "lançamento" : "lançamentos"}`;
}

async function readLinkedFile() {
  const file = await handle.getFile();
  const text = await file.text();
  if (!text.trim()) return null;
  try {
    return parseBackup(text);
  } catch {
    return null;
  }
}

// --- Writing ---

async function ensurePermission() {
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  try {
    // Needs a user gesture; fails (and we show a "reactivate" prompt) when called from the background.
    return (await handle.requestPermission(opts)) === "granted";
  } catch {
    return false;
  }
}

async function writeOnce() {
  if (!(await ensurePermission())) {
    setSnapshot({ status: "needs-permission", error: null });
    return;
  }

  if (!reconciled) {
    const existing = await readLinkedFile();
    if (existing && startedEmpty && !isStateEmpty(existing.state)) {
      candidateState = existing.state;
      setSnapshot({
        status: "restore-available",
        error: null,
        restoreCandidate: { entries: countEntries(existing.state), exportedAt: existing.exportedAt },
      });
      return;
    }
    reconciled = true;
  }

  const writable = await handle.createWritable();
  try {
    await writable.write(JSON.stringify(buildBackup(loadState()), null, 2));
  } catch (err) {
    await writable.abort().catch(() => {});
    throw err;
  }
  await writable.close();
  setSnapshot({ status: "active", error: null, lastWriteAt: Date.now() });
}

async function drain() {
  if (writing || !handle) return;
  writing = true;
  try {
    while (dirty && handle) {
      dirty = false;
      try {
        await writeOnce();
      } catch (err) {
        // Some providers (notably on Android) reject a write right after the file changed; try once more.
        if (err?.name === "InvalidStateError" || err?.name === "NoModificationAllowedError") {
          await new Promise((resolve) => setTimeout(resolve, 500));
          try {
            await writeOnce();
            continue;
          } catch (retryErr) {
            err = retryErr;
          }
        }
        console.error("Falha ao gravar o backup:", err);
        setSnapshot({ status: "error", error: describeError(err) });
        break;
      }
      // Stop writing while we wait on the user (permission or restore prompt).
      if (snapshot.status !== "active") break;
    }
  } finally {
    writing = false;
  }
}

function describeError(err) {
  if (err?.name === "NotFoundError") {
    return "O arquivo de backup não foi encontrado. Escolha o arquivo de novo.";
  }
  if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
    return "O navegador não permitiu gravar no arquivo de backup.";
  }
  return "Não foi possível gravar o arquivo de backup.";
}

function scheduleWrite(delay = WRITE_DEBOUNCE_MS) {
  if (!handle) return;
  dirty = true;
  clearTimeout(timer);
  timer = setTimeout(drain, delay);
}

// --- Public API ---

export async function initBackup() {
  startedEmpty = isStateEmpty(loadState());

  onStateSaved(() => {
    if (snapshot.status === "active" || snapshot.status === "needs-permission" || snapshot.status === "error") {
      scheduleWrite();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && dirty) scheduleWrite(0);
  });

  requestPersistentStorage();

  if (!SUPPORTED) return;
  try {
    handle = (await loadHandle()) ?? null;
  } catch (err) {
    console.warn("Não foi possível ler o arquivo de backup vinculado:", err);
  }
  if (!handle) return;

  let permitted = false;
  try {
    permitted = (await handle.queryPermission({ mode: "readwrite" })) === "granted";
  } catch {
    // treated as not permitted
  }
  setSnapshot({ fileName: handle.name, status: permitted ? "active" : "needs-permission" });
  // Mirror whatever launch-time changes (e.g. monthly recurring entries) happened before we were ready.
  if (permitted) scheduleWrite();
}

// Asks the browser not to evict our storage under disk pressure. It doesn't stop the user
// from clearing data by hand — the backup file is what covers that.
async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return;
    const persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    setSnapshot({ persisted });
  } catch {
    setSnapshot({ persisted: false });
  }
}

// Opens the save dialog so the user can pick (or create) the backup file. Needs a user gesture.
export async function linkBackupFile() {
  let picked;
  try {
    picked = await window.showSaveFilePicker({ suggestedName: SUGGESTED_NAME, types: FILE_TYPES });
  } catch (err) {
    if (err?.name === "AbortError") return false;
    console.error("Não foi possível escolher o arquivo de backup:", err);
    setSnapshot({ status: "error", error: "Não foi possível abrir o seletor de arquivos." });
    return false;
  }
  handle = picked;
  reconciled = false;
  candidateState = null;
  try {
    await saveHandle(picked);
  } catch (err) {
    // Backups still work this session; they just won't resume automatically next time.
    console.warn("Não foi possível guardar o arquivo vinculado:", err);
  }
  setSnapshot({ fileName: picked.name, status: "active", error: null, restoreCandidate: null });
  scheduleWrite(0);
  return true;
}

export async function unlinkBackupFile() {
  handle = null;
  candidateState = null;
  dirty = false;
  clearTimeout(timer);
  try {
    await forgetHandle();
  } catch (err) {
    console.warn("Não foi possível esquecer o arquivo de backup:", err);
  }
  setSnapshot({ fileName: null, status: "off", error: null, restoreCandidate: null, lastWriteAt: null });
}

// Called from a tap on "Reativar": retries the write with a fresh user gesture.
export function resumeBackup() {
  if (!handle) return;
  setSnapshot({ status: "active", error: null });
  scheduleWrite(0);
}

// The user restored from some file on purpose, so what's in the app is now the truth.
export function markSynced() {
  startedEmpty = false;
  reconciled = true;
  candidateState = null;
  if (snapshot.status === "restore-available") {
    setSnapshot({ status: "active", restoreCandidate: null });
    scheduleWrite();
  }
}

// Returns the state found in the linked file (to be merged into the app) and resumes backups.
export function acceptRestoreCandidate() {
  const state = candidateState;
  markSynced();
  scheduleWrite(0);
  return state;
}

// The user chose to keep what's in the app, so the next write replaces the file's content.
export function dismissRestoreCandidate() {
  markSynced();
  scheduleWrite(0);
}

// Manual copy for browsers that can't write a file on their own (or as an extra copy).
export async function saveBackupCopy() {
  const date = new Date().toISOString().slice(0, 10);
  const name = `meu-saldo-backup-${date}.json`;
  const blob = new Blob([JSON.stringify(buildBackup(loadState()), null, 2)], { type: "application/json" });
  const file = new File([blob], name, { type: "application/json" });

  // iOS standalone apps handle downloads poorly; the share sheet can save to Files instead.
  if (!SUPPORTED && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Backup do Meu Saldo" });
      rememberManualBackup();
    } catch (err) {
      if (err?.name !== "AbortError") throw err;
    }
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  rememberManualBackup();
}

function rememberManualBackup() {
  try {
    localStorage.setItem(LAST_MANUAL_KEY, String(Date.now()));
  } catch {
    // not critical
  }
}

export function lastManualBackupAt() {
  try {
    const value = Number(localStorage.getItem(LAST_MANUAL_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

// The "protect your data" nudge comes back after a week so it doesn't nag.
const NUDGE_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export function isNudgeSnoozed() {
  try {
    const value = Number(localStorage.getItem(NUDGE_DISMISSED_KEY));
    return Number.isFinite(value) && Date.now() - value < NUDGE_SNOOZE_MS;
  } catch {
    return false;
  }
}

export function snoozeNudge() {
  try {
    localStorage.setItem(NUDGE_DISMISSED_KEY, String(Date.now()));
  } catch {
    // not critical
  }
}
