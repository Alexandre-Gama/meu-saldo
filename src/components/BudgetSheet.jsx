import { useEffect, useRef, useState } from "react";
import { EXPENSE_CATEGORIES, categoryOf } from "../categories.js";

export default function BudgetSheet({ open, categoryId, currentLimit, onClose, onSave, onRemove }) {
  const [selected, setSelected] = useState(null);
  const [limit, setLimit] = useState("");
  const inputRef = useRef(null);
  const isNew = !categoryId;
  const activeCategoryId = categoryId ?? selected;

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setLimit(currentLimit ? String(currentLimit).replace(".", ",") : "");
  }, [open, categoryId, currentLimit]);

  useEffect(() => {
    if (!open) return;
    if (!isNew || activeCategoryId) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, isNew, activeCategoryId]);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!activeCategoryId) return;
    onSave(activeCategoryId, limit);
  }

  const cat = activeCategoryId ? categoryOf("expense", activeCategoryId) : null;

  return (
    <div className="sheet-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={handleSubmit}>
        <p className="sheet-title">
          {cat ? `Orçamento · ${cat.icon} ${cat.label}` : "Novo orçamento"}
        </p>

        {isNew && !activeCategoryId ? (
          <div className="field">
            <span>Escolha a categoria</span>
            <div className="category-picker" role="radiogroup" aria-label="Categoria">
              {EXPENSE_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={false}
                  className="category-chip"
                  onClick={() => setSelected(c.id)}
                >
                  <span aria-hidden="true">{c.icon}</span> {c.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <label className="field">
              <span>Limite mensal</span>
              <input
                ref={inputRef}
                type="text"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="0,00"
                required
                inputMode="decimal"
                autoComplete="off"
              />
            </label>

            <div className="sheet-actions">
              {!isNew && (
                <button type="button" className="btn btn-danger" onClick={() => onRemove(activeCategoryId)}>
                  Remover
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                Salvar
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
