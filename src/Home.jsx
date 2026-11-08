import { useEffect, useRef, useState } from "react";
import BalanceCard from "./components/BalanceCard.jsx";
import Ledger from "./components/Ledger.jsx";
import EntrySheet from "./components/EntrySheet.jsx";
import BudgetOverview from "./components/BudgetOverview.jsx";
import BudgetSheet from "./components/BudgetSheet.jsx";
import MonthNav from "./components/MonthNav.jsx";
import AccountSheet, { formatDateTime } from "./components/AccountSheet.jsx";
import StatusBanner from "./components/StatusBanner.jsx";
import Splash from "./components/Splash.jsx";
import { parseBackup, countEntries, entriesLabel, saveBackupCopy } from "./backup.js";
import { useCloudData, useUnsentWrites, writeStateChange } from "./cloud.js";
import { signOutAndClear, dataErrorMessage } from "./account.js";
import {
  readLegacyState,
  discardLegacyState,
  isLegacyOfferDismissed,
  dismissLegacyOffer,
} from "./legacy.js";
import {
  emptyState,
  mergeStates,
  parseAmount,
  makeId,
  sumOf,
  currentMonthKey,
  spentByCategory,
  shiftMonthKey,
  dayTimestamp,
  monthKeyOf,
  monthLabel,
  fromDateInput,
  toDateInput,
  realizedOnly,
  maxForecastMonthKey,
} from "./storage.js";
import { DEFAULT_CATEGORY_ID } from "./categories.js";
import {
  generateRecurringInstances,
  addRecurringTemplate,
  getRecurring,
  skipRecurringMonth,
  stopRecurringFrom,
  recurringEntriesFrom,
  monthEntries,
  projectedBalance,
} from "./recurring.js";

// How long to wait for the server before trusting the copy kept on this device.
const SERVER_WAIT_MS = 4000;

export default function Home({ user, lock }) {
  const cloud = useCloudData(user.uid);
  const unsent = useUnsentWrites() || cloud.pending;
  const state = cloud.state;
  // Handlers diff against the data as it is right now, whatever render they were created in.
  const stateRef = useRef(state);
  stateRef.current = state;

  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [sheet, setSheet] = useState({ open: false, type: "income", entry: null });
  const [budgetSheet, setBudgetSheet] = useState({ open: false, categoryId: null });
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [writeError, setWriteError] = useState(null);

  // Data the app kept in this browser before accounts existed, offered for import.
  const [legacy, setLegacy] = useState(readLegacyState);
  const [legacyDismissed, setLegacyDismissed] = useState(isLegacyOfferDismissed);

  // Creates this month's entries for monthly recurrences once per launch. It waits for the
  // server's copy of the data first, so a stale local copy can't bring back something that
  // was deleted on another device; offline (or if the server is slow) it goes ahead anyway.
  const generatedMonth = useRef(null);
  useEffect(() => {
    if (!cloud.loaded) return;
    const month = currentMonthKey();
    if (generatedMonth.current === month) return;

    function generate() {
      generatedMonth.current = month;
      const { state: next, changed } = generateRecurringInstances(stateRef.current, month);
      if (changed) persist(next);
    }

    if (!cloud.fromCache || !navigator.onLine) {
      generate();
      return;
    }
    const timer = setTimeout(generate, SERVER_WAIT_MS);
    return () => clearTimeout(timer);
  }, [cloud.loaded, cloud.fromCache]);

  // Saves the difference between what's on screen and `next`. The screen updates right away
  // (Firestore reports local writes immediately); the returned promise settles once the
  // server confirms, or rejects if it refuses.
  function persist(next) {
    const write = writeStateChange(user.uid, stateRef.current, next);
    write.catch((err) => {
      console.error("Falha ao salvar:", err);
      setWriteError(
        err?.code === "permission-denied"
          ? "O Firestore recusou salvar a alteração. Confira se as regras de segurança foram publicadas."
          : "Não foi possível salvar a última alteração. Tente de novo."
      );
    });
    return write;
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

  // New entries start on today's day-of-month in whichever month is on screen.
  function defaultDateFor(month) {
    return dayTimestamp(month, new Date().getDate());
  }

  function showMonthOf(timestamp) {
    const month = monthKeyOf(timestamp);
    if (month !== monthKey) setMonthKey(month);
  }

  function handleSave({ desc, value, category, date, repeatMonthly }) {
    const trimmedDesc = desc.trim();
    const amount = parseAmount(value);
    if (!trimmedDesc || !Number.isFinite(amount) || amount <= 0) return;

    const original = sheet.entry;
    // Leave the stored timestamp alone when the day wasn't changed.
    let when = original && date === toDateInput(original.date) ? original.date : fromDateInput(date);
    if (!Number.isFinite(when) || monthKeyOf(when) > maxForecastMonthKey()) return;

    // An occurrence of a recurring entry stays in its own month, otherwise its month would be refilled.
    if (original && getRecurring(state, original.recurringId)) {
      const month = monthKeyOf(original.date);
      if (monthKeyOf(when) !== month) when = dayTimestamp(month, new Date(when).getDate());
    }

    const key = sheet.type === "income" ? "incomes" : "expenses";
    const list = state[key];
    const cat = category || DEFAULT_CATEGORY_ID;

    if (original) {
      const nextList = original.pending
        ? // A forecast occurrence becomes a real entry as soon as it's edited.
          [...list, { id: makeId(), desc: trimmedDesc, value: amount, category: cat, date: when, recurringId: original.recurringId }]
        : list.map((item) =>
            item.id === original.id ? { ...item, desc: trimmedDesc, value: amount, category: cat, date: when } : item
          );
      persist({ ...state, [key]: nextList });
      closeSheet();
      showMonthOf(when);
      return;
    }

    const recurringId = repeatMonthly ? makeId() : undefined;
    const entry = { id: makeId(), desc: trimmedDesc, value: amount, category: cat, date: when, recurringId };

    let next = { ...state, [key]: [...list, entry] };
    if (repeatMonthly) {
      next = addRecurringTemplate(next, {
        id: recurringId,
        type: sheet.type,
        desc: trimmedDesc,
        value: amount,
        category: cat,
        day: new Date(when).getDate(),
        startMonth: monthKeyOf(when),
      });
      // An entry dated in a past month still needs this month's occurrence.
      next = generateRecurringInstances(next, currentMonthKey()).state;
    }

    persist(next);
    closeSheet();
    showMonthOf(when);
  }

  function handleDelete(entry) {
    let next = state;
    // Deleting one occurrence of a recurring entry must not bring it back.
    if (entry.recurringId) next = skipRecurringMonth(next, entry.recurringId, monthKeyOf(entry.date));
    if (!entry.pending) {
      next = {
        ...next,
        incomes: next.incomes.filter((i) => i.id !== entry.id),
        expenses: next.expenses.filter((i) => i.id !== entry.id),
      };
    }
    persist(next);
    closeSheet();
  }

  function handleStopRecurring(fromMonth) {
    const recurringId = sheet.entry.recurringId;
    const removed = recurringEntriesFrom(state, recurringId, fromMonth).length;
    if (
      removed > 0 &&
      !confirm(`Isso remove ${entriesLabel(removed)} de ${monthLabel(fromMonth).toLowerCase()} em diante. Continuar?`)
    ) {
      return;
    }
    persist(stopRecurringFrom(state, recurringId, fromMonth));
    closeSheet();
  }

  function handleReset() {
    if (!state.incomes.length && !state.expenses.length) return;
    if (
      confirm(
        "Apagar todos os lançamentos de renda e despesas da sua conta?\n\nIsso vale para todos os seus aparelhos e não dá para desfazer."
      )
    ) {
      persist(emptyState());
    }
  }

  // Adds `incoming` to what's in the account (entries are matched by id, so importing the
  // same data twice changes nothing), plus this month's recurring entries as on any launch.
  function importState(incoming) {
    const merged = mergeStates(stateRef.current, incoming);
    const { state: withRecurring } = generateRecurringInstances(merged, currentMonthKey());
    return persist(withRecurring);
  }

  // Returns a message to show in the account sheet, or null when nothing was imported.
  async function handleImportFile(file) {
    let parsed;
    try {
      parsed = parseBackup(await file.text());
    } catch (err) {
      alert(err.message || "Não foi possível ler o arquivo.");
      return null;
    }
    const total = countEntries(parsed.state);
    const when = parsed.exportedAt ? formatDateTime(parsed.exportedAt) : "data desconhecida";
    if (!confirm(`Importar o backup de ${when} com ${entriesLabel(total)}? Eles serão somados aos dados da sua conta.`)) {
      return null;
    }
    importState(parsed.state);
    return `Backup importado: ${entriesLabel(total)}.`;
  }

  function handleImportLegacy() {
    if (!legacy) return null;
    const total = countEntries(legacy);
    // The copy in this browser is only removed once the server has the data, so a failed
    // import leaves it there to try again.
    importState(legacy).then(discardLegacyState, () => setLegacy(readLegacyState()));
    setLegacy(null);
    return total > 0 ? `Importado: ${entriesLabel(total)}.` : "Importado.";
  }

  function handleDismissLegacy() {
    dismissLegacyOffer();
    setLegacyDismissed(true);
  }

  async function handleSignOut() {
    const warning = unsent
      ? "\n\nHá alterações que ainda não chegaram ao servidor. Se você sair agora, elas serão perdidas."
      : "";
    if (!confirm(`Sair da conta ${user.email}?${warning}`)) return;
    await signOutAndClear();
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

  // Entries dated after today are forecasts: they don't count toward the balance yet.
  const incomeTotal = sumOf(realizedOnly(state.incomes));
  const expenseTotal = sumOf(realizedOnly(state.expenses));

  const todayMonthKey = currentMonthKey();
  const maxMonthKey = maxForecastMonthKey();
  // A month shows its saved entries plus whatever recurring entries are forecast for it.
  const monthIncomes = monthEntries(state, "income", monthKey).sort((a, b) => a.date - b.date);
  const monthExpenses = monthEntries(state, "expense", monthKey).reverse().sort((a, b) => b.date - a.date);
  const monthExpensesByCategory = spentByCategory(monthExpenses, monthKey);
  const canGoNext = monthKey < maxMonthKey;
  const activeRecurringIds = new Set((state.recurring || []).map((t) => t.id));

  const legacyCount = legacy ? countEntries(legacy) : 0;
  const legacyLabel = legacy ? (legacyCount > 0 ? entriesLabel(legacyCount) : "orçamentos e recorrências") : null;

  if (cloud.error) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p className="sheet-title">Não foi possível carregar seus dados</p>
          <p className="sheet-note">{dataErrorMessage(cloud.error)}</p>
          <div className="sheet-actions">
            <button type="button" className="btn btn-ghost" onClick={handleSignOut}>
              Sair
            </button>
            <button type="button" className="btn btn-primary" onClick={cloud.retry}>
              Tentar de novo
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!cloud.loaded) {
    return <Splash>Carregando seus dados…</Splash>;
  }

  return (
    <>
      <header className="topbar">
        <span className="brand">Meu Saldo</span>
        <div className="topbar-actions">
          {lock.supported && (
            <button
              className="icon-btn"
              title={lock.enabled ? "Desativar biometria" : "Ativar biometria"}
              aria-label={lock.enabled ? "Desativar biometria" : "Ativar biometria"}
              onClick={lock.toggle}
            >
              {lock.enabled ? "🔒" : "🔓"}
            </button>
          )}
          <button
            className="icon-btn"
            title="Minha conta"
            aria-label="Minha conta"
            onClick={() => setAccountSheetOpen(true)}
          >
            👤
          </button>
          <button className="icon-btn" title="Limpar tudo" aria-label="Limpar tudo" onClick={handleReset}>⟲</button>
        </div>
      </header>

      <main>
        <StatusBanner
          writeError={writeError}
          legacy={legacyDismissed ? null : legacyLabel}
          onImportLegacy={handleImportLegacy}
          onDismissLegacy={handleDismissLegacy}
          onDismissError={() => setWriteError(null)}
        />

        <BalanceCard incomeTotal={incomeTotal} expenseTotal={expenseTotal} />

        <MonthNav
          monthKey={monthKey}
          isFuture={monthKey > todayMonthKey}
          canNext={canGoNext}
          incomeTotal={sumOf(monthIncomes)}
          expenseTotal={sumOf(monthExpenses)}
          projected={monthKey >= todayMonthKey ? projectedBalance(state, monthKey) : null}
          onPrev={() => setMonthKey((m) => shiftMonthKey(m, -1))}
          onNext={() => setMonthKey((m) => (m < maxMonthKey ? shiftMonthKey(m, 1) : m))}
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
          items={monthExpenses}
          activeRecurringIds={activeRecurringIds}
          onAdd={() => openAdd("expense")}
          onEdit={(item) => openEdit("expense", item)}
        />
      </main>

      <EntrySheet
        open={sheet.open}
        type={sheet.type}
        entry={sheet.entry}
        template={sheet.entry ? getRecurring(state, sheet.entry.recurringId) : null}
        defaultDate={defaultDateFor(monthKey)}
        maxDate={toDateInput(dayTimestamp(maxMonthKey, 31))}
        onClose={closeSheet}
        onSave={handleSave}
        onDelete={handleDelete}
        onStopRecurring={handleStopRecurring}
      />

      <AccountSheet
        open={accountSheetOpen}
        email={user.email}
        unsent={unsent}
        legacyLabel={legacyLabel}
        onClose={() => setAccountSheetOpen(false)}
        onExport={() => saveBackupCopy(state)}
        onImportFile={handleImportFile}
        onImportLegacy={handleImportLegacy}
        onSignOut={handleSignOut}
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
