import { DEFAULT_CATEGORY_ID } from "./categories.js";

const STORAGE_KEY = "meu-saldo:v1";

export const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function normalizeEntry(entry) {
  return {
    ...entry,
    category: typeof entry.category === "string" ? entry.category : DEFAULT_CATEGORY_ID,
    date: Number.isFinite(entry.date) ? entry.date : Date.now(),
  };
}

function normalizeRecurring(item) {
  return {
    id: item.id,
    type: item.type === "income" ? "income" : "expense",
    desc: String(item.desc ?? ""),
    value: Number(item.value) || 0,
    category: typeof item.category === "string" ? item.category : DEFAULT_CATEGORY_ID,
    day: Number.isFinite(item.day) ? item.day : 1,
    startMonth: typeof item.startMonth === "string" ? item.startMonth : currentMonthKey(),
  };
}

export function emptyState() {
  return { incomes: [], expenses: [], budgets: {}, recurring: [] };
}

export function normalizeState(parsed) {
  if (!parsed || typeof parsed !== "object") return emptyState();
  return {
    incomes: Array.isArray(parsed.incomes) ? parsed.incomes.map(normalizeEntry) : [],
    expenses: Array.isArray(parsed.expenses) ? parsed.expenses.map(normalizeEntry) : [],
    budgets: parsed.budgets && typeof parsed.budgets === "object" ? parsed.budgets : {},
    recurring: Array.isArray(parsed.recurring) ? parsed.recurring.map(normalizeRecurring) : [],
  };
}

export function isStateEmpty(state) {
  return (
    state.incomes.length === 0 &&
    state.expenses.length === 0 &&
    state.recurring.length === 0 &&
    Object.keys(state.budgets).length === 0
  );
}

// Union of two states by entry id, so restoring a backup never drops what was
// added since. For budgets the base (current) limit wins on a clash.
export function mergeStates(base, incoming) {
  const unionById = (a, b) => {
    const seen = new Set(a.map((item) => item.id));
    return [...a, ...b.filter((item) => !seen.has(item.id))];
  };
  return {
    incomes: unionById(base.incomes, incoming.incomes),
    expenses: unionById(base.expenses, incoming.expenses),
    recurring: unionById(base.recurring, incoming.recurring),
    budgets: { ...incoming.budgets, ...base.budgets },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return normalizeState(JSON.parse(raw));
  } catch (err) {
    console.error("Não foi possível ler os dados salvos:", err);
    return emptyState();
  }
}

const saveListeners = new Set();

// Lets other modules (the file backup) react after every successful save
// without storage.js having to know about them.
export function onStateSaved(listener) {
  saveListeners.add(listener);
  return () => saveListeners.delete(listener);
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Não foi possível salvar os dados:", err);
    alert("Não foi possível salvar. O armazenamento do navegador pode estar cheio ou bloqueado.");
    return;
  }
  for (const listener of saveListeners) {
    try {
      listener(state);
    } catch (err) {
      console.error("Falha ao notificar o backup:", err);
    }
  }
}

export function parseAmount(raw) {
  let s = String(raw).trim().replace(/[^\d.,-]/g, "");
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

export function makeId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function sumOf(list) {
  return list.reduce((total, item) => total + item.value, 0);
}

export function monthKeyOf(timestamp) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey() {
  return monthKeyOf(Date.now());
}

export function spentByCategory(list, monthKey) {
  const totals = {};
  for (const item of list) {
    if (monthKeyOf(item.date) !== monthKey) continue;
    totals[item.category] = (totals[item.category] || 0) + item.value;
  }
  return totals;
}

export function filterByMonth(list, monthKey) {
  return list.filter((item) => monthKeyOf(item.date) === monthKey);
}

export function shiftMonthKey(monthKey, delta) {
  const [year, month] = monthKey.split("-").map(Number);
  return monthKeyOf(new Date(year, month - 1 + delta, 1).getTime());
}

const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

export function monthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const label = MONTH_LABEL.format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function dayTimestamp(monthKey, day) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, lastDay), 12, 0, 0).getTime();
}
