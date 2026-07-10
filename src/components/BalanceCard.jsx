import { currency } from "../storage.js";

export default function BalanceCard({ incomeTotal, expenseTotal }) {
  const balance = incomeTotal - expenseTotal;
  const status = balance > 0 ? "positive" : balance < 0 ? "negative" : "";

  return (
    <section className={`balance-card ${status}`}>
      <p className="eyebrow">saldo disponível</p>
      <p className="balance">{currency.format(balance)}</p>

      <div className="balance-card-stats">
        <div className="stat">
          <span className="stat-icon stat-icon-in" aria-hidden="true">↑</span>
          <div>
            <span className="stat-label">Entradas</span>
            <span className="stat-value">{currency.format(incomeTotal)}</span>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon stat-icon-out" aria-hidden="true">↓</span>
          <div>
            <span className="stat-label">Saídas</span>
            <span className="stat-value">{currency.format(expenseTotal)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
