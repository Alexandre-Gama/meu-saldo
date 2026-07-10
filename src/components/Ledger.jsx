import { currency } from "../storage.js";

export default function Ledger({ type, title, items, onAdd, onEdit }) {
  return (
    <section className="ledger" data-type={type}>
      <div className="ledger-header">
        <span className="ledger-title">{title}</span>
        <button className="add-btn" onClick={onAdd} aria-label={`Adicionar ${title}`}>+</button>
      </div>

      {items.length === 0 ? (
        <p className="empty-hint">nenhum lançamento ainda</p>
      ) : (
        <ul className="ledger-list">
          {items.map((item) => (
            <li key={item.id} className="ledger-item">
              <button className="ledger-item-btn" onClick={() => onEdit(item)}>
                <span className="avatar" aria-hidden="true">{type === "income" ? "↑" : "↓"}</span>
                <span className="desc">{item.desc}</span>
                <span className="val">{currency.format(item.value)}</span>
                <span className="chevron" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
