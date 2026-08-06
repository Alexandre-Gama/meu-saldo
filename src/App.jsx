import { useState } from "react";
import BalanceCard from "./components/BalanceCard.jsx";
import Ledger from "./components/Ledger.jsx";
import EntrySheet from "./components/EntrySheet.jsx";
import BudgetOverview from "./components/BudgetOverview.jsx";
import BudgetSheet from "./components/BudgetSheet.jsx";
import MonthNav from "./components/MonthNav.jsx";
import {
  loadState,
  saveState,
  parseAmount,
  makeId,
  sumOf,
  currentMonthKey,
  spentByCategory,
  filterByMonth,
  shiftMonthKey,
  dayTimestamp,
} from "./storage.js";
import { DEFAULT_CATEGORY_ID } from "./categories.js";
import { generateRecurringInstances, addRecurringTemplate, removeRecurringTemplate, isRecurring } from "./recurring.js";

function initState() {
  const loaded = loadState();
  const { state: withRecurring, changed } = generateRecurringInstances(loaded, currentMonthKey());
  if (changed) saveState(withRecurring);
  return withRecurring;
}

export default function App() {
  const [state, setState] = useState(initState);
  const [monthKey, setMonthKey] = useState(currentMonthKey);
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

  function handleSave({ desc, value, category, repeatMonthly }) {
    const trimmedDesc = desc.trim();
    const amount = parseAmount(value);
    if (!trimmedDesc || !Number.isFinite(amount) || amount <= 0) return;

    const key = sheet.type === "income" ? "incomes" : "expenses";
    const list = state[key];
    const cat = category || DEFAULT_CATEGORY_ID;

    if (sheet.entry) {
      const nextList = list.map((item) =>
        item.id === sheet.entry.id ? { ...item, desc: trimmedDesc, value: amount, category: cat } : item
      );
      persist({ ...state, [key]: nextList });
      closeSheet();
      return;
    }

    const day = new Date().getDate();
    const date = dayTimestamp(monthKey, day);
    const recurringId = repeatMonthly ? makeId() : undefined;
    const entry = { id: makeId(), desc: trimmedDesc, value: amount, category: cat, date, recurringId };

    let next = { ...state, [key]: [...list, entry] };
    if (repeatMonthly) {
      next = addRecurringTemplate(next, {
        id: recurringId,
        type: sheet.type,
        desc: trimmedDesc,
        value: amount,
        category: cat,
        day,
        startMonth: monthKey,
      });
    }

    persist(next);
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

  function handleStopRecurring(recurringId) {
    persist(removeRecurringTemplate(state, recurringId));
    closeSheet();
  }

  function handleReset() {
    if (!state.incomes.length && !state.expenses.length) return;
    if (confirm("Apagar todos os lançamentos de renda e despesas deste aparelho?")) {
      persist({ incomes: [], expenses: [], budgets: {}, recurring: [] });
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

  const monthIncomes = filterByMonth(state.incomes, monthKey);
  const monthExpenses = filterByMonth(state.expenses, monthKey);
  const monthExpensesByCategory = spentByCategory(state.expenses, monthKey);
  const canGoNext = monthKey < currentMonthKey();
  const activeRecurringIds = new Set((state.recurring || []).map((t) => t.id));

  return (
    <>
      <header className="topbar">
        <span className="brand">Meu Saldo</span>
        <button className="icon-btn" title="Limpar tudo" aria-label="Limpar tudo" onClick={handleReset}>⟲</button>
      </header>

      <main>
        <BalanceCard incomeTotal={incomeTotal} expenseTotal={expenseTotal} />

        <MonthNav
          monthKey={monthKey}
          canNext={canGoNext}
          incomeTotal={sumOf(monthIncomes)}
          expenseTotal={sumOf(monthExpenses)}
          onPrev={() => setMonthKey((m) => shiftMonthKey(m, -1))}
          onNext={() => setMonthKey((m) => (m < currentMonthKey() ? shiftMonthKey(m, 1) : m))}
        />

        <BudgetOverview
          spentByCategory={monthExpensesByCategory}
          budgets={state.budgets}
          onEditCategory={openEditBudget}
          onAddBudget={openAddBudget}
        />

        <Ledger
          type="income"
          title="renda"
          items={monthIncomes}
          activeRecurringIds={activeRecurringIds}
          onAdd={() => openAdd("income")}
          onEdit={(item) => openEdit("income", item)}
        />

        <Ledger
          type="expense"
          title="despesas"
          items={[...monthExpenses].reverse()}
          activeRecurringIds={activeRecurringIds}
          onAdd={() => openAdd("expense")}
          onEdit={(item) => openEdit("expense", item)}
        />
      </main>

      <EntrySheet
        open={sheet.open}
        type={sheet.type}
        entry={sheet.entry}
        isRecurring={Boolean(sheet.entry?.recurringId) && isRecurring(state, sheet.entry?.recurringId)}
        onClose={closeSheet}
        onSave={handleSave}
        onDelete={handleDelete}
        onStopRecurring={() => handleStopRecurring(sheet.entry.recurringId)}
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
