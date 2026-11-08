import { useSyncExternalStore } from "react";

function subscribeOnline(callback) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine);
}

// One message at a time, most urgent first.
function pickBanner({ online, writeError, legacy, onImportLegacy, onDismissLegacy, onDismissError }) {
  if (writeError) {
    return {
      tone: "error",
      text: writeError,
      action: { label: "Entendi", run: onDismissError },
    };
  }
  if (legacy) {
    return {
      tone: "info",
      text: `Encontramos dados salvos neste aparelho (${legacy}), de antes do login. Importar para a sua conta?`,
      action: { label: "Importar", run: onImportLegacy },
      dismissible: true,
      onDismiss: onDismissLegacy,
    };
  }
  if (!online) {
    return {
      tone: "info",
      text: "Sem conexão. Suas alterações ficam guardadas neste aparelho e são enviadas quando a internet voltar.",
    };
  }
  return null;
}

export default function StatusBanner(props) {
  const online = useOnline();
  const banner = pickBanner({ ...props, online });
  if (!banner) return null;

  return (
    <aside className={`banner ${banner.tone}`} role="status">
      <span className="banner-text">{banner.text}</span>
      {(banner.action || banner.dismissible) && (
        <span className="banner-actions">
          {banner.action && (
            <button type="button" className="banner-btn" onClick={banner.action.run}>
              {banner.action.label}
            </button>
          )}
          {banner.dismissible && (
            <button type="button" className="banner-btn banner-btn-ghost" onClick={banner.onDismiss} aria-label="Dispensar aviso">
              ×
            </button>
          )}
        </span>
      )}
    </aside>
  );
}
