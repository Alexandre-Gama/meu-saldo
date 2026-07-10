const STORAGE_KEY = "meu-saldo:v1";

export const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { incomes: [], expenses: [] };
    const parsed = JSON.parse(raw);
    return {
      incomes: Array.isArray(parsed.incomes) ? parsed.incomes : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    };
  } catch (err) {
    console.error("Não foi possível ler os dados salvos:", err);
    return { incomes: [], expenses: [] };
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
