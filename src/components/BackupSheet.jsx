import { useRef, useState } from "react";
import { linkBackupFile, unlinkBackupFile, resumeBackup, saveBackupCopy, entriesLabel } from "../backup.js";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "data desconhecida" : dateTime.format(date);
}

function StatusLine({ backup }) {
  const { status, fileName, lastWriteAt, error, restoreCandidate } = backup;

  if (status === "unsupported") {
    return (
      <p className="backup-status">
        Este navegador não consegue gravar o arquivo sozinho. No Chrome (Android ou computador) o backup automático
        funciona; aqui, salve cópias manualmente.
      </p>
    );
  }
  if (status === "active") {
    return (
      <p className="backup-status ok">
        <strong>Backup automático ativo</strong>
        <span>Arquivo: {fileName}</span>
        {lastWriteAt && <span>Última gravação: {formatDateTime(lastWriteAt)}</span>}
      </p>
    );
  }
  if (status === "needs-permission") {
    return (
      <p className="backup-status warn">
        <strong>Backup pausado</strong>
        <span>O navegador precisa que você confirme o acesso ao arquivo {fileName}.</span>
      </p>
    );
  }
  if (status === "restore-available") {
    return (
      <p className="backup-status warn">
        <strong>Backup encontrado</strong>
        <span>
          O arquivo {fileName} tem {entriesLabel(restoreCandidate.entries)}
          {restoreCandidate.exportedAt ? ` (de ${formatDateTime(restoreCandidate.exportedAt)})` : ""}. Restaure para não
          perdê-los.
        </span>
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className="backup-status error">
        <strong>Problema no backup</strong>
        <span>{error}</span>
      </p>
    );
  }
  return (
    <p className="backup-status">
      <strong>Backup automático desligado</strong>
      <span>Ative para que cada alteração seja salva num arquivo fora do navegador.</span>
    </p>
  );
}

export default function BackupSheet({ open, backup, onClose, onRestoreFile, onAcceptRestore, onDismissRestore }) {
  const fileInput = useRef(null);
  const [message, setMessage] = useState(null);

  if (!open) return null;

  const linked = Boolean(backup.fileName);

  function close() {
    setMessage(null);
    onClose();
  }

  async function handleFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = await onRestoreFile(file);
    if (result) setMessage(result);
  }

  async function handleUnlink() {
    if (!confirm("Desativar o backup automático? O arquivo atual continua no aparelho, mas deixa de ser atualizado.")) {
      return;
    }
    await unlinkBackupFile();
  }

  async function handleSaveCopy() {
    try {
      await saveBackupCopy();
    } catch (err) {
      console.error(err);
      alert("Não foi possível salvar a cópia.");
    }
  }

  return (
    <div className="sheet-overlay open" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet" role="dialog" aria-label="Backup dos dados">
        <p className="sheet-title">Backup dos dados</p>

        <StatusLine backup={backup} />

        {message && <p className="backup-message">{message}</p>}

        <div className="sheet-stack">
          {backup.status === "restore-available" && (
            <>
              <button type="button" className="btn btn-primary" onClick={onAcceptRestore}>
                Restaurar do arquivo
              </button>
              <button type="button" className="btn btn-ghost" onClick={onDismissRestore}>
                Manter os dados atuais e substituir o arquivo
              </button>
            </>
          )}
          {(backup.status === "needs-permission" || backup.status === "error") && linked && (
            <button type="button" className="btn btn-primary" onClick={resumeBackup}>
              {backup.status === "error" ? "Tentar de novo" : "Reativar backup"}
            </button>
          )}
          {backup.supported && !linked && (
            <button type="button" className="btn btn-primary" onClick={linkBackupFile}>
              Ativar backup automático
            </button>
          )}
          {backup.supported && linked && (
            <div className="sheet-actions">
              <button type="button" className="btn btn-danger" onClick={handleUnlink}>
                Desativar
              </button>
              <button type="button" className="btn btn-ghost" onClick={linkBackupFile}>
                Trocar arquivo
              </button>
            </div>
          )}
          <button type="button" className="btn btn-ghost" onClick={handleSaveCopy}>
            Salvar uma cópia agora
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => fileInput.current?.click()}>
            Restaurar de um arquivo
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleFileChosen}
          />
        </div>

        <p className="sheet-note">
          Se você limpar os dados do navegador, abra o Meu Saldo de novo e escolha “Restaurar de um arquivo” para voltar
          tudo. Guarde o arquivo fora da pasta do navegador (por exemplo em Documentos); ele não é criptografado.
          {backup.persisted !== null &&
            ` Armazenamento protegido contra remoção automática: ${backup.persisted ? "sim" : "não"}.`}
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
