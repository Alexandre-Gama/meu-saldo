import { useEffect, useState } from "react";
import BalanceCard from "./components/BalanceCard.jsx";
import Ledger from "./components/Ledger.jsx";
import EntrySheet from "./components/EntrySheet.jsx";
import BudgetOverview from "./components/BudgetOverview.jsx";
import BudgetSheet from "./components/BudgetSheet.jsx";
import MonthNav from "./components/MonthNav.jsx";
import BackupSheet, { formatDateTime } from "./components/BackupSheet.jsx";
import BackupBanner from "./components/BackupBanner.jsx";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
  verifyBiometric,
} from "./auth.js";
import {
  useBackup,
  parseBackup,
  countEntries,
  entriesLabel,
  markSynced,
  acceptRestoreCandidate,
  dismissRestoreCandidate,
} from "./backup.js";
import {
  loadState,
  saveState,
  isStateEmpty,
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
  const [backupSheetOpen, setBackupSheetOpen] = useState(false);
  const backup = useBackup();

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(isBiometricEnabled);
  // "pending" blocks all rendering below until the OS biometric check resolves.
  const [authStatus, setAuthStatus] = useState(() => (isBiometricEnabled() ? "pending" : "ok"));

  useEffect(() => {
    isBiometricAvailable().then(setBiometricSupported);
  }, []);

  useEffect(() => {
    if (authStatus !== "pending") return;
    let cancelled = false;
    verifyBiometric()
      .then(() => {
        if (!cancelled) setAuthStatus("ok");
      })
      .catch(() => {
        // No valid biometric check (denied, dismissed via back button, etc.) — close the app.
        // window.close() only works for script-opened tabs / installed PWA contexts; when the
        // browser blocks it we still never fall through to rendering app content.
        if (cancelled) return;
        setAuthStatus("denied");
        window.close();
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  async function handleToggleBiometric() {
    if (biometricEnabled) {
      if (!confirm("Desativar a autenticação por biometria?")) return;
      try {
        await verifyBiometric();
      } catch {
        alert("Não foi possível confirmar sua identidade. A biometria continua ativada.");
        return;
      }
      disableBiometric();
      setBiometricEnabledState(false);
      return;
    }
    try {
      await enableBiometric();
      setBiometricEnabledState(true);
    } catch {
      alert("Não foi possível ativar a biometria neste aparelho.");
    }
  }

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
    const backupNote = backup.status === "active" ? "\n\nO arquivo de backup automático também será esvaziado." : "";
    if (confirm(`Apagar todos os lançamentos de renda e despesas deste aparelho?${backupNote}`)) {
      persist({ incomes: [], expenses: [], budgets: {}, recurring: [] });
    }
  }

  // Restored data goes through the same monthly-recurring pass as a normal launch.
  function applyRestored(next) {
    const { state: withRecurring } = generateRecurringInstances(next, currentMonthKey());
    persist(withRecurring);
  }

  // Returns a message to show in the backup sheet, or null when nothing was restored.
  async function handleRestoreFile(file) {
    let parsed;
    try {
      parsed = parseBackup(await file.text());
    } catch (err) {
      alert(err.message || "Não foi possível ler o arquivo.");
      return null;
    }
    const total = countEntries(parsed.state);
    const when = parsed.exportedAt ? formatDateTime(parsed.exportedAt) : "data desconhecida";
    const replacing = isStateEmpty(state) ? "" : "\n\nOs dados atuais deste aparelho serão substituídos.";
    if (!confirm(`Restaurar o backup de ${when} com ${entriesLabel(total)}?${replacing}`)) return null;
    applyRestored(parsed.state);
    markSynced();
    return `Backup restaurado: ${entriesLabel(total)}.`;
  }

  // The linked backup file has data and the app started empty: bring it in, keeping anything added since.
  function handleAcceptRestore() {
    const incoming = acceptRestoreCandidate();
    if (incoming) applyRestored(mergeStates(state, incoming));
  }

  function handleDismissRestore() {
    if (!confirm("Manter os dados atuais? O conteúdo do arquivo de backup será substituído pelo que está no app agora.")) {
      return;
    }
    dismissRestoreCandidate();
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

  if (authStatus !== "ok") {
    return null;
  }

  return (
    <>
      <header className="topbar">
        <span className="brand">Meu Saldo</span>
        <div className="topbar-actions">
          {biometricSupported && (
            <button
              className="icon-btn"
              title={biometricEnabled ? "Desativar biometria" : "Ativar biometria"}
              aria-label={biometricEnabled ? "Desativar biometria" : "Ativar biometria"}
              onClick={handleToggleBiometric}
            >
              {biometricEnabled ? "🔒" : "🔓"}
            </button>
          )}
          <button
            className="icon-btn"
            title="Backup dos dados"
            aria-label="Backup dos dados"
            onClick={() => setBackupSheetOpen(true)}
          >
            💾
          </button>
          <button className="icon-btn" title="Limpar tudo" aria-label="Limpar tudo" onClick={handleReset}>⟲</button>
        </div>
      </header>

      <main>
        <BackupBanner
          backup={backup}
          hasData={!isStateEmpty(state)}
          onOpenSheet={() => setBackupSheetOpen(true)}
          onAcceptRestore={handleAcceptRestore}
          onDismissRestore={handleDismissRestore}
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

      <BackupSheet
        open={backupSheetOpen}
        backup={backup}
        onClose={() => setBackupSheetOpen(false)}
        onRestoreFile={handleRestoreFile}
        onAcceptRestore={handleAcceptRestore}
        onDismissRestore={handleDismissRestore}
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
