import { useState } from "react";
import BalanceCard from "./components/BalanceCard.jsx";
import Ledger from "./components/Ledger.jsx";
import EntrySheet from "./components/EntrySheet.jsx";
import BudgetOverview from "./components/BudgetOverview.jsx";
import BudgetSheet from "./components/BudgetSheet.jsx";
import { loadState, saveState, parseAmount, makeId, sumOf, currentMonthKey, spentByCategory } from "./storage.js";
import { DEFAULT_CATEGORY_ID } from "./categories.js";

export default function App() {
  const [state, setState] = useState(loadState);
  const [sheet, setSheet] = useState({ open: false, type: "income", entry: null });
  const [budgetSheet, setBudgetSheet] = useState({ open: false, categoryId: null });

  function persist(next) {
    setState(next);
    saveState(next);
  }

  function openAdd(type) {
    setSheet({ open: true, type, entry: null });
  }

  function openEdit(type, entry) {
    setSheet({ open: true, type, entry });
  }

  function closeSheet() {
    setSheet((s) => ({ ...s, open: false }));
  }

  function handleSave({ desc, value, category }) {
    const trimmedDesc = desc.trim();
    const amount = parseAmount(value);
    if (!trimmedDesc || !Number.isFinite(amount) || amount <= 0) return;

    const key = sheet.type === "income" ? "incomes" : "expenses";
    const list = state[key];
    const cat = category || DEFAULT_CATEGORY_ID;

    const nextList = sheet.entry
      ? list.map((item) =>
          item.id === sheet.entry.id ? { ...item, desc: trimmedDesc, value: amount, category: cat } : item
        )
      : [...list, { id: makeId(), desc: trimmedDesc, value: amount, category: cat, date: Date.now() }];

    persist({ ...state, [key]: nextList });
    closeSheet();
  }

  function handleDelete(id) {
    persist({
      ...state,
      incomes: state.incomes.filter((i) => i.id !== id),
      expenses: state.expenses.filter((i) => i.id !== id),
    });
    closeSheet();
  }

  function handleReset() {
    if (!state.incomes.length && !state.expenses.length) return;
    if (confirm("Apagar todos os lançamentos de renda e despesas deste aparelho?")) {
      persist({ incomes: [], expenses: [], budgets: {} });
    }
  }

  function openAddBudget() {
    setBudgetSheet({ open: true, categoryId: null });
  }

  function openEditBudget(categoryId) {
    setBudgetSheet({ open: true, categoryId });
  }

  function closeBudgetSheet() {
    setBudgetSheet((s) => ({ ...s, open: false }));
  }

  function handleSaveBudget(categoryId, limitRaw) {
    const limit = parseAmount(limitRaw);
    if (!Number.isFinite(limit) || limit <= 0) return;
    persist({ ...state, budgets: { ...state.budgets, [categoryId]: limit } });
    closeBudgetSheet();
  }

  function handleRemoveBudget(categoryId) {
    const nextBudgets = { ...state.budgets };
    delete nextBudgets[categoryId];
    persist({ ...state, budgets: nextBudgets });
    closeBudgetSheet();
  }

  const incomeTotal = sumOf(state.incomes);
  const expenseTotal = sumOf(state.expenses);
  const monthExpensesByCategory = spentByCategory(state.expenses, currentMonthKey());

  return (
    <>
      <header className="topbar">
        <span className="brand">Meu Saldo</span>
        <button className="icon-btn" title="Limpar tudo" aria-label="Limpar tudo" onClick={handleReset}>⟲</button>
      </header>

      <main>
        <BalanceCard incomeTotal={incomeTotal} expenseTotal={expenseTotal} />

        <BudgetOverview
          spentByCategory={monthExpensesByCategory}
          budgets={state.budgets}
          onEditCategory={openEditBudget}
          onAddBudget={openAddBudget}
        />

        <Ledger
          type="income"
          title="renda"
          items={state.incomes}
          onAdd={() => openAdd("income")}
          onEdit={(item) => openEdit("income", item)}
        />

        <Ledger
          type="expense"
          title="despesas"
          items={[...state.expenses].reverse()}
          onAdd={() => openAdd("expense")}
          onEdit={(item) => openEdit("expense", item)}
        />
      </main>

      <EntrySheet
        open={sheet.open}
        type={sheet.type}
        entry={sheet.entry}
        onClose={closeSheet}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <BudgetSheet
        open={budgetSheet.open}
        categoryId={budgetSheet.categoryId}
        currentLimit={budgetSheet.categoryId ? state.budgets[budgetSheet.categoryId] : null}
        onClose={closeBudgetSheet}
        onSave={handleSaveBudget}
        onRemove={handleRemoveBudget}
      />
    </>
  );
}
