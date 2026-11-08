import { useEffect, useState } from "react";
import Home from "./Home.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import SetupScreen from "./components/SetupScreen.jsx";
import Splash from "./components/Splash.jsx";
import { isFirebaseConfigured } from "./firebase.js";
import { useAuthUser } from "./account.js";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
  verifyBiometric,
} from "./auth.js";

// Optional fingerprint/face lock on top of the account. While someone is signed in and the
// lock is "pending", nothing is rendered until the OS biometric check resolves.
function useBiometricLock(signedIn) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(isBiometricEnabled);
  const [status, setStatus] = useState(() => (isBiometricEnabled() ? "pending" : "ok"));

  useEffect(() => {
    isBiometricAvailable().then(setSupported);
  }, []);

  useEffect(() => {
    if (!signedIn || status !== "pending") return;
    let cancelled = false;
    verifyBiometric()
      .then(() => {
        if (!cancelled) setStatus("ok");
      })
      .catch(() => {
        // No valid biometric check (denied, dismissed via back button, etc.) — close the app.
        // window.close() only works for script-opened tabs / installed PWA contexts; when the
        // browser blocks it we still never fall through to rendering app content.
        if (cancelled) return;
        setStatus("denied");
        window.close();
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, status]);

  async function toggle() {
    if (enabled) {
      if (!confirm("Desativar a autenticação por biometria?")) return;
      try {
        await verifyBiometric();
      } catch {
        alert("Não foi possível confirmar sua identidade. A biometria continua ativada.");
        return;
      }
      disableBiometric();
      setEnabled(false);
      return;
    }
    try {
      await enableBiometric();
      setEnabled(true);
    } catch {
      alert("Não foi possível ativar a biometria neste aparelho.");
    }
  }

  // Typing the account password just proved who's here, so no second check right after.
  function unlock() {
    setStatus("ok");
  }

  return { supported, enabled, status, toggle, unlock };
}

function Gate() {
  const user = useAuthUser();
  const lock = useBiometricLock(Boolean(user));

  if (user === undefined) return <Splash />;
  if (!user) return <AuthScreen beforeSignIn={lock.unlock} />;
  if (lock.status !== "ok") return null;
  // `key` gives each account a fresh screen if someone else signs in on this device.
  return <Home key={user.uid} user={user} lock={lock} />;
}

export default function App() {
  return isFirebaseConfigured ? <Gate /> : <SetupScreen />;
}
