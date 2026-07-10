import { useEffect, useRef, useState } from "react";

export default function EntrySheet({ open, type, entry, onClose, onSave, onDelete }) {
  const [desc, setDesc] = useState("");
  const [value, setValue] = useState("");
  const descRef = useRef(null);
  const isEdit = Boolean(entry);

  useEffect(() => {
    if (!open) return;
    setDesc(entry?.desc ?? "");
    setValue(entry ? String(entry.value).replace(".", ",") : "");
    const t = setTimeout(() => descRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open, entry]);

  if (!open) return null;

  const typeLabel = type === "income" ? "renda" : "despesa";

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ desc, value });
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

        <label className="field">
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

        <div className="sheet-actions">
          {isEdit && (
            <button type="button" className="btn btn-danger" onClick={() => onDelete(entry.id)}>
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
