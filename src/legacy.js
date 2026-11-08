import { normalizeState, isStateEmpty } from "./storage.js";

// Before accounts existed the app kept everything in this browser's localStorage
// (plus an optional backup file). People who used it that way can import what
// they have into their account once.

const LEGACY_KEY = "meu-saldo:v1";
const OFFER_DISMISSED_KEY = "meu-saldo:legacy-offer-dismissed";

// The old file-backup feature left these behind.
const OLD_BACKUP_KEYS = ["meu-saldo:last-manual-backup", "meu-saldo:backup-nudge-dismissed"];
const OLD_BACKUP_DB = "meu-saldo-backup";

// The data saved on this device before accounts, or null when there's nothing to import.
export function readLegacyState() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const state = normalizeState(JSON.parse(raw));
    return isStateEmpty(state) ? null : state;
  } catch {
    return null;
  }
}

// Called once the data is safely in the account, so a different person using this
// browser later isn't offered someone else's entries.
export function discardLegacyState() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // not critical
  }
}

export function isLegacyOfferDismissed() {
  try {
    return localStorage.getItem(OFFER_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissLegacyOffer() {
  try {
    localStorage.setItem(OFFER_DISMISSED_KEY, "1");
  } catch {
    // not critical
  }
}

// Drops what the removed file-backup feature stored in the browser. The backup
// file itself stays wherever the user saved it and can still be imported.
export function cleanUpOldBackupFeature() {
  try {
    for (const key of OLD_BACKUP_KEYS) localStorage.removeItem(key);
    indexedDB?.deleteDatabase(OLD_BACKUP_DB);
  } catch {
    // not critical
  }
}
