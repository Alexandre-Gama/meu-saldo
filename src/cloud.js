import { useEffect, useState, useSyncExternalStore } from "react";
import { collection, doc, onSnapshot, writeBatch, waitForPendingWrites } from "firebase/firestore";
import { db } from "./firebase.js";
import { COLLECTIONS, diffStates, docsToState, chunk } from "./cloudDiff.js";
import { emptyState, normalizeState } from "./storage.js";

const MAX_BATCH = 450; // Firestore allows 500 writes per batch

// --- Writes this session has sent and the server hasn't confirmed yet ---------
// A snapshot's own "pending" flag can't see a pending delete (the document is
// already gone from it), so the app counts its commits as well.

let inflight = 0;
const watchers = new Set();

function trackWrite(promise) {
  inflight++;
  watchers.forEach((fn) => fn());
  const done = () => {
    inflight--;
    watchers.forEach((fn) => fn());
  };
  promise.then(done, done);
  return promise;
}

export function useUnsentWrites() {
  return useSyncExternalStore(
    (fn) => {
      watchers.add(fn);
      return () => watchers.delete(fn);
    },
    () => inflight > 0
  );
}

// --- Reading -------------------------------------------------------------------

// Calls `onData({ state, fromCache, pending })` after every change, once all four
// collections have answered. `fromCache` is true while the data still comes only
// from this device (offline, or the server hasn't replied yet).
export function subscribeUserData(uid, onData, onError) {
  const parts = {};
  let failed = false;

  function emit() {
    if (COLLECTIONS.some((name) => !parts[name])) return;
    const docs = Object.fromEntries(COLLECTIONS.map((name) => [name, parts[name].docs]));
    onData({
      state: normalizeState(docsToState(docs)),
      fromCache: COLLECTIONS.some((name) => parts[name].fromCache),
      pending: COLLECTIONS.some((name) => parts[name].pending),
    });
  }

  const unsubscribers = COLLECTIONS.map((name) =>
    onSnapshot(
      collection(db, "users", uid, name),
      // Metadata changes tell us when the server has answered after a cache-only start.
      { includeMetadataChanges: true },
      (snap) => {
        parts[name] = {
          docs: snap.docs.map((d) => ({ id: d.id, data: d.data() })),
          fromCache: snap.metadata.fromCache,
          pending: snap.metadata.hasPendingWrites,
        };
        emit();
      },
      (err) => {
        if (failed) return;
        failed = true;
        onError(err);
      }
    )
  );

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

const INITIAL = { loaded: false, state: emptyState(), fromCache: true, pending: false, error: null };

// The user's data, live. `state` is the same `{ incomes, expenses, budgets, recurring }`
// shape the rest of the app already used; it's empty until `loaded` is true.
export function useCloudData(uid) {
  const [snapshot, setSnapshot] = useState(INITIAL);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setSnapshot(INITIAL);
    return subscribeUserData(
      uid,
      (data) => setSnapshot({ ...data, loaded: true, error: null }),
      (error) => setSnapshot({ ...INITIAL, error })
    );
  }, [uid, attempt]);

  return { ...snapshot, retry: () => setAttempt((n) => n + 1) };
}

// --- Writing -------------------------------------------------------------------

// Sends only what differs between `prev` and `next`. Resolves once the server has
// confirmed it (which can take a while offline — the change is already visible
// and kept on the device in the meantime), and rejects if the server refuses it.
export function writeStateChange(uid, prev, next) {
  const ops = diffStates(prev, next);
  const commits = chunk(ops, MAX_BATCH).map((group) => {
    const batch = writeBatch(db);
    for (const op of group) {
      const ref = doc(db, "users", uid, op.collection, op.id);
      if (op.type === "set") batch.set(ref, op.data);
      else batch.delete(ref);
    }
    return trackWrite(batch.commit());
  });
  return Promise.all(commits);
}

// Resolves when everything written so far has reached the server.
export function whenWritesSettled() {
  return waitForPendingWrites(db);
}
