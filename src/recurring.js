import { makeId, monthKeyOf, dayTimestamp, currentMonthKey, shiftMonthKey, filterByMonth } from "./storage.js";

// A template produces one entry per month from `startMonth` up to (not
// including) `stopMonth`, except for months the user deleted on purpose.
function coversMonth(template, monthKey) {
  if (template.startMonth > monthKey) return false;
  if (template.stopMonth && monthKey >= template.stopMonth) return false;
  if (template.skipped?.includes(monthKey)) return false;
  return true;
}

function hasInstance(list, template, monthKey) {
  return list.some((item) => item.recurringId === template.id && monthKeyOf(item.date) === monthKey);
}

// Materializes one entry per active recurring template for `monthKey`, unless
// an entry linked to that template already exists in that month. Templates
// only apply from the month they were created onward.
export function generateRecurringInstances(state, monthKey) {
  const recurring = state.recurring || [];
  if (recurring.length === 0) return { state, changed: false };

  const incomes = [...state.incomes];
  const expenses = [...state.expenses];
  let changed = false;

  for (const template of recurring) {
    if (!coversMonth(template, monthKey)) continue;
    const list = template.type === "income" ? incomes : expenses;
    if (hasInstance(list, template, monthKey)) continue;

    list.push({
      id: makeId(),
      desc: template.desc,
      value: template.value,
      category: template.category,
      date: dayTimestamp(monthKey, template.day),
      recurringId: template.id,
    });
    changed = true;
  }

  if (!changed) return { state, changed: false };
  return { state: { ...state, incomes, expenses }, changed: true };
}

// Id shape for forecast occurrences, which only exist in memory until the user
// edits them (then they become regular entries).
function pendingId(templateId, monthKey) {
  return `pending:${templateId}:${monthKey}`;
}

// Forecast of what recurring templates will produce in a future month, without
// saving anything: they become real entries when their month arrives.
export function pendingOccurrences(state, monthKey, type, todayMonthKey = currentMonthKey()) {
  if (monthKey <= todayMonthKey) return [];
  const list = type === "income" ? state.incomes : state.expenses;
  const out = [];
  for (const template of state.recurring || []) {
    if (template.type !== type || !coversMonth(template, monthKey)) continue;
    if (hasInstance(list, template, monthKey)) continue;
    out.push({
      id: pendingId(template.id, monthKey),
      desc: template.desc,
      value: template.value,
      category: template.category,
      date: dayTimestamp(monthKey, template.day),
      recurringId: template.id,
      pending: true,
    });
  }
  return out;
}

// Everything that belongs to `monthKey`: saved entries plus forecast occurrences.
export function monthEntries(state, type, monthKey) {
  const list = type === "income" ? state.incomes : state.expenses;
  return [...filterByMonth(list, monthKey), ...pendingOccurrences(state, monthKey, type)];
}

// Balance expected at the end of `monthKey`: every saved entry up to then
// (including ones dated later this month) plus recurring forecasts in between.
export function projectedBalance(state, monthKey, todayMonthKey = currentMonthKey()) {
  let total = 0;
  for (const item of state.incomes) if (monthKeyOf(item.date) <= monthKey) total += item.value;
  for (const item of state.expenses) if (monthKeyOf(item.date) <= monthKey) total -= item.value;

  for (let m = shiftMonthKey(todayMonthKey, 1); m <= monthKey; m = shiftMonthKey(m, 1)) {
    for (const item of pendingOccurrences(state, m, "income", todayMonthKey)) total += item.value;
    for (const item of pendingOccurrences(state, m, "expense", todayMonthKey)) total -= item.value;
  }
  return total;
}

export function addRecurringTemplate(state, { id, type, desc, value, category, day, startMonth }) {
  const template = {
    id: id || makeId(),
    type,
    desc,
    value,
    category,
    day,
    startMonth,
    stopMonth: null,
    skipped: [],
  };
  return { ...state, recurring: [...(state.recurring || []), template] };
}

export function getRecurring(state, recurringId) {
  return (state.recurring || []).find((t) => t.id === recurringId) || null;
}

export function isRecurring(state, recurringId) {
  return getRecurring(state, recurringId) !== null;
}

// Deleting a single occurrence must not bring it back on the next launch.
export function skipRecurringMonth(state, templateId, monthKey) {
  if (!isRecurring(state, templateId)) return state;
  return {
    ...state,
    recurring: state.recurring.map((t) =>
      t.id === templateId && !t.skipped.includes(monthKey) ? { ...t, skipped: [...t.skipped, monthKey] } : t
    ),
  };
}

// Saved entries of a template that fall in `fromMonth` or later; stopping the
// recurrence removes them.
export function recurringEntriesFrom(state, templateId, fromMonth) {
  const after = (item) => item.recurringId === templateId && monthKeyOf(item.date) >= fromMonth;
  return [...state.incomes.filter(after), ...state.expenses.filter(after)];
}

// The earliest month a recurrence can be stopped from: the one after it began,
// otherwise it would never have produced anything.
export function earliestStopMonth(template) {
  return shiftMonthKey(template.startMonth, 1);
}

// Stops the recurrence from `fromMonth` onward: months before it keep their
// entries, `fromMonth` and later lose theirs and are no longer forecast.
export function stopRecurringFrom(state, templateId, fromMonth) {
  const template = getRecurring(state, templateId);
  if (!template || fromMonth < earliestStopMonth(template)) return state;
  const stale = (item) => item.recurringId === templateId && monthKeyOf(item.date) >= fromMonth;
  return {
    ...state,
    incomes: state.incomes.filter((item) => !stale(item)),
    expenses: state.expenses.filter((item) => !stale(item)),
    recurring: state.recurring.map((t) =>
      t.id === templateId ? { ...t, stopMonth: fromMonth, skipped: t.skipped.filter((m) => m < fromMonth) } : t
    ),
  };
}
