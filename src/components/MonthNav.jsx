import { currency, monthLabel } from "../storage.js";

export default function MonthNav({
  monthKey,
  isFuture,
  canNext,
  incomeTotal,
  expenseTotal,
  projected,
  onPrev,
  onNext,
}) {
  return (
    <section className="month-nav">
      <div className="month-nav-row">
        <button className="month-nav-btn" onClick={onPrev} aria-label="Mês anterior">‹</button>
        <span className="month-nav-label">
          {monthLabel(monthKey)}
          {isFuture && <span className="month-nav-badge">previsão</span>}
        </span>
        <button className="month-nav-btn" onClick={onNext} disabled={!canNext} aria-label="Próximo mês">›</button>
      </div>
      <div className="month-nav-stats">
        <span className="month-nav-stat income">↑ {currency.format(incomeTotal)}</span>
        <span className="month-nav-stat expense">↓ {currency.format(expenseTotal)}</span>
      </div>
      {projected !== null && (
        <p className="month-nav-projection">
          saldo previsto no fim do mês{" "}
          <strong className={projected < 0 ? "negative" : ""}>{currency.format(projected)}</strong>
        </p>
      )}
    </section>
  );
}
