import { currency, dateLabel, isScheduled } from "../storage.js";
import { categoryOf } from "../categories.js";

export default function Ledger({ type, title, items, activeRecurringIds, onAdd, onEdit }) {
  return (
    <section className="ledger" data-type={type}>
      <div className="ledger-header">
        <span className="ledger-title">{title}</span>
        <button className="add-btn" onClick={onAdd} aria-label={`Adicionar ${title}`}>+</button>
      </div>

      {items.length === 0 ? (
        <p className="empty-hint">nenhum lançamento neste mês</p>
      ) : (
        <ul className="ledger-list">
          {items.map((item) => {
            const cat = categoryOf(type, item.category);
            const scheduled = isScheduled(item);
            return (
              <li key={item.id} className={`ledger-item ${scheduled ? "scheduled" : ""}`}>
                <button className="ledger-item-btn" onClick={() => onEdit(item)}>
                  <span className="avatar" aria-hidden="true">{cat.icon}</span>
                  <span className="ledger-item-main">
                    <span className="desc">{item.desc}</span>
                    <span className="category-tag">
                      {cat.label} · {dateLabel(item.date)}
                      {scheduled && " · previsto"}
                      {activeRecurringIds?.has(item.recurringId) && <span title="Recorrente"> · 🔁</span>}
                    </span>
                  </span>
                  <span className="val">{currency.format(item.value)}</span>
                  <span className="chevron" aria-hidden="true">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
