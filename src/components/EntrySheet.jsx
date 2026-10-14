import { useEffect, useRef, useState } from "react";
import { categoriesFor, DEFAULT_CATEGORY_ID } from "../categories.js";
import { monthLabel, monthKeyOf, shiftMonthKey, toDateInput } from "../storage.js";

// A recurring occurrence stays in its own month, so the picker is fenced to it.
function monthBounds(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  return { min: `${monthKey}-01`, max: `${monthKey}-${String(last).padStart(2, "0")}` };
}

export default function EntrySheet({
  open,
  type,
  entry,
  defaultDate,
  maxDate,
  template,
  onClose,
  onSave,
  onDelete,
  onStopRecurring,
}) {
  const [desc, setDesc] = useState("");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState(DEFAULT_CATEGORY_ID);
  const [date, setDate] = useState("");
  const [repeatMonthly, setRepeatMonthly] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopFrom, setStopFrom] = useState("");
  const descRef = useRef(null);
  const isEdit = Boolean(entry);
  const categories = categoriesFor(type);

  useEffect(() => {
    if (!open) return;
    setDesc(entry?.desc ?? "");
    setValue(entry ? String(entry.value).replace(".", ",") : "");
    setCategory(entry?.category ?? DEFAULT_CATEGORY_ID);
    setDate(toDateInput(entry ? entry.date : defaultDate));
    setRepeatMonthly(false);
    setStopping(false);
    const t = setTimeout(() => descRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open, entry]);

  if (!open) return null;

  const typeLabel = type === "income" ? "renda" : "despesa";
  const entryMonth = entry ? monthKeyOf(entry.date) : null;
  const dateBounds = template && entryMonth ? monthBounds(entryMonth) : { min: "2000-01-01", max: maxDate };
  const earliestStop = template ? shiftMonthKey(template.startMonth, 1) : null;

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ desc, value, category, date, repeatMonthly });
  }

  function openStopPicker() {
    // Default to the month after this occurrence: it keeps this one and drops the rest.
    const suggested = shiftMonthKey(entryMonth, 1);
    setStopFrom(template.stopMonth ?? (suggested < earliestStop ? earliestStop : suggested));
    setStopping(true);
  }

  function handleStop() {
    if (!/^\d{4}-\d{2}$/.test(stopFrom) || stopFrom < earliestStop) return;
    onStopRecurring(stopFrom);
  }

  return (
    <div className="sheet-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={handleSubmit}>
        <p className="sheet-title">{isEdit ? `Editar ${typeLabel}` : `Nova ${typeLabel}`}</p>

        <label className="field">
          <span>Descrição</span>
          <input
            ref={descRef}
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Ex: Salário"
            required
            maxLength={40}
            autoComplete="off"
          />
        </label>

        <label className="field field-mono">
          <span>Valor</span>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0,00"
            required
            inputMode="decimal"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span>Data</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={dateBounds.min}
            max={dateBounds.max}
            required
          />
        </label>

        <div className="field">
          <span>Categoria</span>
          <div className="category-picker" role="radiogroup" aria-label="Categoria">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={category === c.id}
                className={`category-chip ${category === c.id ? "selected" : ""}`}
                onClick={() => setCategory(c.id)}
              >
                <span aria-hidden="true">{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
        </div>

        {!isEdit && (
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={repeatMonthly}
              onChange={(e) => setRepeatMonthly(e.target.checked)}
            />
            <span>🔁 Repetir todo mês</span>
          </label>
        )}

        {template && !stopping && (
          <button type="button" className="stop-recurring-btn" onClick={openStopPicker}>
            {template.stopMonth
              ? `🔁 Se repete até ${monthLabel(shiftMonthKey(template.stopMonth, -1))} · Alterar`
              : `🔁 Esta ${typeLabel} se repete todo mês · Parar de repetir`}
          </button>
        )}

        {template && stopping && (
          <div className="stop-recurring-panel">
            <label className="field">
              <span>Parar de repetir a partir de</span>
              <input
                type="month"
                value={stopFrom}
                onChange={(e) => setStopFrom(e.target.value)}
                min={earliestStop}
                placeholder="AAAA-MM"
              />
            </label>
            <p className="sheet-note">
              Os lançamentos anteriores a esse mês continuam. A partir dele, esta {typeLabel} deixa de se repetir
              e os lançamentos já criados são removidos.
            </p>
            <div className="sheet-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setStopping(false)}>
                Voltar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleStop}
                disabled={!/^\d{4}-\d{2}$/.test(stopFrom) || stopFrom < earliestStop}
              >
                Parar de repetir
              </button>
            </div>
          </div>
        )}

        <div className="sheet-actions">
          {isEdit && (
            <button type="button" className="btn btn-danger" onClick={() => onDelete(entry)}>
              Excluir
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            {isEdit ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </form>
    </div>
  );
}
