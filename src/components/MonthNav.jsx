import { currency, monthLabel } from "../storage.js";

export default function MonthNav({ monthKey, canNext, incomeTotal, expenseTotal, onPrev, onNext }) {
  return (
    <section className="month-nav">
      <div className="month-nav-row">
        <button className="month-nav-btn" onClick={onPrev} aria-label="Mês anterior">‹</button>
        <span className="month-nav-label">{monthLabel(monthKey)}</span>
        <button className="month-nav-btn" onClick={onNext} disabled={!canNext} aria-label="Próximo mês">›</button>
      </div>
      <div className="month-nav-stats">
        <span className="month-nav-stat income">↑ {currency.format(incomeTotal)}</span>
        <span className="month-nav-stat expense">↓ {currency.format(expenseTotal)}</span>
      </div>
    </section>
  );
}
