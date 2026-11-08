import { missingConfig } from "../firebase.js";

// Shown when the build has no Firebase project configured, instead of a blank page.
export default function SetupScreen() {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <p className="auth-brand">Meu Saldo</p>
        <p className="sheet-title">Falta configurar o Firebase</p>
        <p className="sheet-note">
          Este build não tem os dados do projeto Firebase. Faltam estas variáveis de ambiente:
        </p>
        <ul className="setup-list">
          {missingConfig.map((name) => (
            <li key={name}>
              <code>{name}</code>
            </li>
          ))}
        </ul>
        <p className="sheet-note">
          Para rodar no seu computador, copie <code>.env.example</code> para <code>.env.local</code> e preencha os
          valores. Para o site publicado, cadastre as mesmas variáveis no GitHub. O passo a passo está em{" "}
          <code>docs/firebase-setup.md</code>.
        </p>
      </div>
    </div>
  );
}
