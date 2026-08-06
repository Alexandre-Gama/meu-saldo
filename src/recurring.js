import { makeId, monthKeyOf, dayTimestamp } from "./storage.js";

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
    if (template.startMonth > monthKey) continue;
    const list = template.type === "income" ? incomes : expenses;
    const alreadyExists = list.some(
      (item) => item.recurringId === template.id && monthKeyOf(item.date) === monthKey
    );
    if (alreadyExists) continue;

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

export function addRecurringTemplate(state, { id, type, desc, value, category, day, startMonth }) {
  const template = { id: id || makeId(), type, desc, value, category, day, startMonth };
  return { ...state, recurring: [...(state.recurring || []), template] };
}

export function removeRecurringTemplate(state, templateId) {
  return { ...state, recurring: (state.recurring || []).filter((t) => t.id !== templateId) };
}

export function isRecurring(state, recurringId) {
  return (state.recurring || []).some((t) => t.id === recurringId);
}
