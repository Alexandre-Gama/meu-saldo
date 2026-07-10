import { useState } from "react";
import BalanceCard from "./components/BalanceCard.jsx";
import Ledger from "./components/Ledger.jsx";
import EntrySheet from "./components/EntrySheet.jsx";
import { loadState, saveState, parseAmount, makeId, sumOf } from "./storage.js";

export default function App() {
  const [state, setState] = useState(loadState);
  const [sheet, setSheet] = useState({ open: false, type: "income", entry: null });

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

  function handleSave({ desc, value }) {
    const trimmedDesc = desc.trim();
    const amount = parseAmount(value);
    if (!trimmedDesc || !Number.isFinite(amount) || amount <= 0) return;

    const key = sheet.type === "income" ? "incomes" : "expenses";
    const list = state[key];

    const nextList = sheet.entry
      ? list.map((item) => (item.id === sheet.entry.id ? { ...item, desc: trimmedDesc, value: amount } : item))
      : [...list, { id: makeId(), desc: trimmedDesc, value: amount }];

    persist({ ...state, [key]: nextList });
    closeSheet();
  }

  function handleDelete(id) {
    persist({
      incomes: state.incomes.filter((i) => i.id !== id),
      expenses: state.expenses.filter((i) => i.id !== id),
    });
    closeSheet();
  }

  function handleReset() {
    if (!state.incomes.length && !state.expenses.length) return;
    if (confirm("Apagar todos os lançamentos de renda e despesas deste aparelho?")) {
      persist({ incomes: [], expenses: [] });
    }
  }

  const incomeTotal = sumOf(state.incomes);
  const expenseTotal = sumOf(state.expenses);

  return (
    <>
      <header className="topbar">
        <span className="brand">Meu Saldo</span>
        <button className="icon-btn" title="Limpar tudo" aria-label="Limpar tudo" onClick={handleReset}>⟲</button>
      </header>

      <main>
        <BalanceCard incomeTotal={incomeTotal} expenseTotal={expenseTotal} />

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
    </>
  );
}
