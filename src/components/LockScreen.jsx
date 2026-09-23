import { useState } from "react";

export default function LockScreen({ onUnlock, onDisable }) {
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleUnlock() {
    setChecking(true);
    setFailed(false);
    try {
      await onUnlock();
    } catch {
      setFailed(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <div className="lock-icon" aria-hidden="true">🔒</div>
        <p className="lock-title">Meu Saldo está protegido</p>
        <p className="lock-hint">Use a biometria do seu aparelho para continuar.</p>

        <button className="btn btn-primary lock-unlock-btn" onClick={handleUnlock} disabled={checking}>
          {checking ? "Verificando…" : "Desbloquear"}
        </button>

        {failed && (
          <p className="lock-error">Não foi possível confirmar sua identidade. Tente novamente.</p>
        )}

        <button className="lock-disable-link" onClick={onDisable}>
          Desativar biometria
        </button>
      </div>
    </div>
  );
}
