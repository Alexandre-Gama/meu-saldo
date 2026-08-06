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

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { incomes: [], expenses: [], budgets: {} };
    const parsed = JSON.parse(raw);
    return {
      incomes: Array.isArray(parsed.incomes) ? parsed.incomes.map(normalizeEntry) : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses.map(normalizeEntry) : [],
      budgets: parsed.budgets && typeof parsed.budgets === "object" ? parsed.budgets : {},
    };
  } catch (err) {
    console.error("Não foi possível ler os dados salvos:", err);
    return { incomes: [], expenses: [], budgets: {} };
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Não foi possível salvar os dados:", err);
    alert("Não foi possível salvar. O armazenamento do navegador pode estar cheio ou bloqueado.");
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
