// Pure helpers that translate the app state to Firestore documents and back, so
// the UI code can keep working with plain `{ incomes, expenses, budgets, recurring }`
// objects. Nothing here touches Firebase, which keeps it easy to test.
//
// Layout in Firestore (everything belongs to one user):
//   users/{uid}/incomes/{id}      one document per income entry
//   users/{uid}/expenses/{id}     one document per expense entry
//   users/{uid}/recurring/{id}    one document per monthly template
//   users/{uid}/budgets/{categoryId}   { limit }

export const COLLECTIONS = ["incomes", "expenses", "recurring", "budgets"];

// Firestore rejects `undefined`, so optional fields are only added when present.
function entryDoc(item, createdAt) {
  const data = {
    desc: String(item.desc ?? ""),
    value: item.value,
    category: item.category,
    date: item.date,
    createdAt,
  };
  if (typeof item.recurringId === "string") data.recurringId = item.recurringId;
  return data;
}

function recurringDoc(template) {
  return {
    type: template.type,
    desc: template.desc,
    value: template.value,
    category: template.category,
    day: template.day,
    startMonth: template.startMonth,
    stopMonth: template.stopMonth ?? null,
    skipped: [...(template.skipped ?? [])],
  };
}

function budgetDoc(limit) {
  return { limit };
}

// `createdAt` keeps entries in the order they were added (Firestore would
// otherwise hand them back sorted by random id). Entries that don't have one yet
// get consecutive values, so a batch of new entries keeps its array order.
function entryDocs(list, previous, now) {
  const docs = new Map();
  let fresh = 0;
  for (const item of list) {
    let createdAt = item.createdAt;
    if (!Number.isFinite(createdAt)) createdAt = previous?.get(item.id)?.createdAt;
    if (!Number.isFinite(createdAt)) createdAt = now + fresh++;
    docs.set(item.id, entryDoc(item, createdAt));
  }
  return docs;
}

function stateToDocs(state, previousDocs, now) {
  return {
    incomes: entryDocs(state.incomes, previousDocs?.incomes, now),
    expenses: entryDocs(state.expenses, previousDocs?.expenses, now),
    recurring: new Map((state.recurring ?? []).map((t) => [t.id, recurringDoc(t)])),
    budgets: new Map(Object.entries(state.budgets ?? {}).map(([id, limit]) => [id, budgetDoc(limit)])),
  };
}

// What has to be written so that `prev` becomes `next`:
// [{ type: "set", collection, id, data } | { type: "delete", collection, id }]
export function diffStates(prev, next, now = Date.now()) {
  const before = stateToDocs(prev, null, now);
  const after = stateToDocs(next, before, now);
  const ops = [];

  for (const collection of COLLECTIONS) {
    const old = before[collection];
    const current = after[collection];
    for (const [id, data] of current) {
      if (!old.has(id) || JSON.stringify(old.get(id)) !== JSON.stringify(data)) {
        ops.push({ type: "set", collection, id, data });
      }
    }
    for (const id of old.keys()) {
      if (!current.has(id)) ops.push({ type: "delete", collection, id });
    }
  }
  return ops;
}

// `docs` is `{ [collection]: [{ id, data }] }` as read from Firestore. The result
// still goes through `normalizeState` in the caller to fill in any gaps.
export function docsToState(docs) {
  const byAge = (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || (a.id < b.id ? -1 : 1);
  const entries = (list) => list.map(({ id, data }) => ({ id, ...data })).sort(byAge);

  return {
    incomes: entries(docs.incomes ?? []),
    expenses: entries(docs.expenses ?? []),
    recurring: (docs.recurring ?? []).map(({ id, data }) => ({ id, ...data })),
    budgets: Object.fromEntries((docs.budgets ?? []).map(({ id, data }) => [id, data.limit])),
  };
}

// Firestore batches accept at most 500 writes.
export function chunk(list, size) {
  const groups = [];
  for (let i = 0; i < list.length; i += size) groups.push(list.slice(i, i + size));
  return groups;
}
