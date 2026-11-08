import { useRef, useState } from "react";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "data desconhecida" : dateTime.format(date);
}

export default function AccountSheet({
  open,
  email,
  unsent,
  legacyLabel,
  onClose,
  onExport,
  onImportFile,
  onImportLegacy,
  onSignOut,
}) {
  const fileInput = useRef(null);
  const [message, setMessage] = useState(null);

  if (!open) return null;

  function close() {
    setMessage(null);
    onClose();
  }

  async function handleFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = await onImportFile(file);
    if (result) setMessage(result);
  }

  async function handleExport() {
    try {
      await onExport();
    } catch (err) {
      console.error(err);
      alert("Não foi possível salvar a cópia.");
    }
  }

  async function handleImportLegacy() {
    const result = await onImportLegacy();
    if (result) setMessage(result);
  }

  return (
    <div className="sheet-overlay open" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet" role="dialog" aria-label="Minha conta">
        <p className="sheet-title">Minha conta</p>

        <p className={`info-box ${unsent ? "warn" : "ok"}`}>
          <strong>{email}</strong>
          <span>
            {unsent
              ? "Há alterações esperando para serem enviadas. Elas seguem assim que houver internet."
              : "Seus dados estão guardados na nuvem e aparecem em qualquer aparelho em que você entrar."}
          </span>
        </p>

        {message && <p className="sheet-message">{message}</p>}

        <div className="sheet-stack">
          {legacyLabel && (
            <button type="button" className="btn btn-primary" onClick={handleImportLegacy}>
              Importar o que está salvo neste aparelho ({legacyLabel})
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={handleExport}>
            Baixar uma cópia dos dados
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => fileInput.current?.click()}>
            Importar de um arquivo de backup
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={handleFileChosen} />
          <button type="button" className="btn btn-danger btn-block" onClick={onSignOut}>
            Sair da conta
          </button>
        </div>

        <p className="sheet-note">
          A cópia é um arquivo sem criptografia; guarde-o num lugar seguro. Os backups feitos pelas versões antigas do app
          também podem ser importados aqui, e os lançamentos são somados aos que já estão na conta.
        </p>

        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={close}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
