export const EXPENSE_CATEGORIES = [
  { id: "moradia", label: "Moradia", icon: "🏠" },
  { id: "mercado", label: "Mercado", icon: "🛒" },
  { id: "transporte", label: "Transporte", icon: "🚗" },
  { id: "contas", label: "Contas", icon: "🧾" },
  { id: "assinaturas", label: "Assinaturas", icon: "🔁" },
  { id: "saude", label: "Saúde", icon: "💊" },
  { id: "educacao", label: "Educação", icon: "📚" },
  { id: "lazer", label: "Lazer", icon: "🎮" },
  { id: "outros", label: "Outros", icon: "📦" },
];

export const INCOME_CATEGORIES = [
  { id: "salario", label: "Salário", icon: "💼" },
  { id: "freelance", label: "Freelance", icon: "💻" },
  { id: "investimentos", label: "Investimentos", icon: "📈" },
  { id: "presente", label: "Presente", icon: "🎁" },
  { id: "outros", label: "Outros", icon: "📦" },
];

export const DEFAULT_CATEGORY_ID = "outros";

export function categoriesFor(type) {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function categoryOf(type, categoryId) {
  const list = categoriesFor(type);
  return list.find((c) => c.id === categoryId) || list.find((c) => c.id === DEFAULT_CATEGORY_ID);
}
