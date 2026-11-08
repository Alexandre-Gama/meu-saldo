import { normalizeState } from "./storage.js";

// A backup is a plain JSON file with the user's entries. Data lives in the account
// now; the file is for taking a copy out, and for importing the copies made by
// earlier versions of the app (same format).

const BACKUP_APP_ID = "meu-saldo";
const BACKUP_VERSION = 1;

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

// Hands the user a JSON copy of their data. iOS standalone apps handle downloads
// poorly; the share sheet can save to Files instead.
export async function saveBackupCopy(state) {
  const date = new Date().toISOString().slice(0, 10);
  const name = `meu-saldo-backup-${date}.json`;
  const blob = new Blob([JSON.stringify(buildBackup(state), null, 2)], { type: "application/json" });
  const file = new File([blob], name, { type: "application/json" });

  if (!("showSaveFilePicker" in window) && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Backup do Meu Saldo" });
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
}
