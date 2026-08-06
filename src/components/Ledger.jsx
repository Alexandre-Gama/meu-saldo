import { currency } from "../storage.js";
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
            return (
              <li key={item.id} className="ledger-item">
                <button className="ledger-item-btn" onClick={() => onEdit(item)}>
                  <span className="avatar" aria-hidden="true">{cat.icon}</span>
                  <span className="ledger-item-main">
                    <span className="desc">{item.desc}</span>
                    <span className="category-tag">
                      {cat.label}
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
