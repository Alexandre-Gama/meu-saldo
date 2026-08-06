import { currency } from "../storage.js";
import { EXPENSE_CATEGORIES } from "../categories.js";

export default function BudgetOverview({ spentByCategory, budgets, onEditCategory, onAddBudget }) {
  const rows = EXPENSE_CATEGORIES
    .map((cat) => ({
      cat,
      spent: spentByCategory[cat.id] || 0,
      limit: budgets[cat.id] || 0,
    }))
    .filter((row) => row.spent > 0 || row.limit > 0)
    .sort((a, b) => b.spent - a.spent);

  return (
    <section className="budget-overview">
      <div className="ledger-header">
        <span className="ledger-title">orçamento do mês</span>
        <button className="add-btn" onClick={onAddBudget} aria-label="Novo orçamento">+</button>
      </div>

      {rows.length === 0 ? (
        <p className="empty-hint">defina um limite mensal por categoria para acompanhar seus gastos</p>
      ) : (
        <ul className="budget-list">
          {rows.map(({ cat, spent, limit }) => {
            const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
            const over = limit > 0 && spent > limit;
            return (
              <li key={cat.id} className="budget-row">
                <button className="budget-row-btn" onClick={() => onEditCategory(cat.id)}>
                  <span className="budget-row-top">
                    <span className="budget-row-label">
                      <span aria-hidden="true">{cat.icon}</span> {cat.label}
                    </span>
                    <span className={`budget-row-value ${over ? "over" : ""}`}>
                      {currency.format(spent)}
                      {limit > 0 && <span className="budget-row-limit"> / {currency.format(limit)}</span>}
                    </span>
                  </span>
                  {limit > 0 && (
                    <span className="budget-bar-track">
                      <span
                        className={`budget-bar-fill ${over ? "over" : ""}`}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
