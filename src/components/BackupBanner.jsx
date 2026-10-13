import { useState } from "react";
import { formatDateTime } from "./BackupSheet.jsx";
import {
  linkBackupFile,
  resumeBackup,
  saveBackupCopy,
  lastManualBackupAt,
  entriesLabel,
  isNudgeSnoozed,
  snoozeNudge,
} from "../backup.js";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

// One message at a time, most urgent first. Problems that need the user always show;
// the softer "protect your data" nudges can be dismissed and come back after a week.
function pickBanner({ backup, hasData, onOpenSheet, onAcceptRestore, onDismissRestore }) {
  const { status } = backup;

  if (status === "restore-available") {
    const { entries, exportedAt } = backup.restoreCandidate;
    const when = exportedAt ? ` de ${formatDateTime(exportedAt)}` : "";
    return {
      tone: "info",
      text: `O arquivo de backup tem ${entriesLabel(entries)}${when}. Restaurar?`,
      action: { label: "Restaurar", run: onAcceptRestore },
      secondary: { label: "Ignorar", run: onDismissRestore },
    };
  }
  if (status === "needs-permission") {
    return {
      tone: "info",
      text: "Backup automático pausado. Confirme o acesso ao arquivo para voltar a salvar.",
      action: { label: "Reativar", run: resumeBackup },
    };
  }
  if (status === "error") {
    return { tone: "error", text: backup.error, action: { label: "Ver", run: onOpenSheet } };
  }

  if (!hasData && (status === "off" || status === "unsupported")) {
    return {
      tone: "info",
      text: "Já usou o Meu Saldo antes? Restaure seus dados a partir do arquivo de backup.",
      action: { label: "Restaurar", run: onOpenSheet },
      dismissible: true,
    };
  }
  if (hasData && status === "off") {
    return {
      tone: "info",
      text: "Seus dados só estão neste navegador. Ative o backup automático em arquivo para não perdê-los.",
      action: { label: "Ativar", run: linkBackupFile },
      dismissible: true,
    };
  }
  if (hasData && status === "unsupported") {
    const last = lastManualBackupAt();
    if (!last || Date.now() - last > TWO_WEEKS_MS) {
      return {
        tone: "info",
        text: "Salve uma cópia dos seus dados para não perdê-los se o navegador for limpo.",
        action: { label: "Salvar cópia", run: () => saveBackupCopy().catch((err) => console.error(err)) },
        dismissible: true,
      };
    }
  }
  return null;
}

export default function BackupBanner(props) {
  const [snoozed, setSnoozed] = useState(isNudgeSnoozed);
  const banner = pickBanner(props);

  if (!banner || (banner.dismissible && snoozed)) return null;

  function dismiss() {
    snoozeNudge();
    setSnoozed(true);
  }

  return (
    <aside className={`backup-banner ${banner.tone}`} role="status">
      <span className="backup-banner-text">{banner.text}</span>
      <span className="backup-banner-actions">
        <button type="button" className="banner-btn" onClick={banner.action.run}>
          {banner.action.label}
        </button>
        {banner.secondary && (
          <button type="button" className="banner-btn banner-btn-ghost" onClick={banner.secondary.run}>
            {banner.secondary.label}
          </button>
        )}
        {banner.dismissible && (
          <button type="button" className="banner-btn banner-btn-ghost" onClick={dismiss} aria-label="Dispensar aviso">
            ×
          </button>
        )}
      </span>
    </aside>
  );
}
