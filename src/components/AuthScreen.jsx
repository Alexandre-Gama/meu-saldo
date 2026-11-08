import { useState } from "react";
import { signIn, signUp, sendPasswordReset, authErrorMessage, MIN_PASSWORD_LENGTH } from "../account.js";

export default function AuthScreen({ beforeSignIn }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const signingUp = mode === "signup";

  function switchMode(next) {
    setMode(next);
    setConfirmation("");
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (signingUp) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
        return;
      }
      if (password !== confirmation) {
        setError("As senhas não são iguais.");
        return;
      }
    }

    setBusy(true);
    // Typing the password counts as the identity check, so the biometric lock
    // doesn't ask again right after.
    beforeSignIn?.();
    try {
      await (signingUp ? signUp : signIn)(email, password);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Digite o seu e-mail acima para receber o link.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setNotice("Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha.");
    } catch (err) {
      setError(authErrorMessage(err));
    }
    setBusy(false);
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <p className="auth-brand">Meu Saldo</p>
        <p className="auth-tagline">Sistema de planejamento e controle financeiro simples e fácil de usar.</p>

        <div className="auth-tabs" role="tablist" aria-label="Entrar ou criar conta">
          <button
            type="button"
            role="tab"
            aria-selected={!signingUp}
            className={`auth-tab${signingUp ? "" : " active"}`}
            onClick={() => switchMode("signin")}
          >
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={signingUp}
            className={`auth-tab${signingUp ? " active" : ""}`}
            onClick={() => switchMode("signup")}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </label>

          <label className="field">
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signingUp ? "new-password" : "current-password"}
              required
            />
          </label>

          {signingUp && (
            <label className="field">
              <span>Repita a senha</span>
              <input
                type="password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
          )}

          {error && (
            <p className="form-message error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="form-message ok" role="status">
              {notice}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Aguarde…" : signingUp ? "Criar conta" : "Entrar"}
          </button>

          {!signingUp && (
            <button type="button" className="link-btn" onClick={handleForgotPassword} disabled={busy}>
              Esqueci minha senha
            </button>
          )}
        </form>

        {signingUp && (
          <p className="sheet-note auth-note">
            Use uma senha com pelo menos {MIN_PASSWORD_LENGTH} caracteres. Se você esquecer, dá para criar outra pelo
            e-mail.
          </p>
        )}
      </div>
    </div>
  );
}
