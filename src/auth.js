const ENABLED_KEY = "meu-saldo:biometric-enabled";
const CREDENTIAL_KEY = "meu-saldo:biometric-credential-id";
const RP_NAME = "Meu Saldo";
const USER_ID = new TextEncoder().encode("meu-saldo-local-user");

function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuffer(base64url) {
  const padded = base64url.padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const str = atob(base64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}

// Only true when the device has a fingerprint/face reader (or similar platform
// authenticator) available to the browser — never for devices without one.
export async function isBiometricAvailable() {
  if (typeof window === "undefined") return false;
  if (!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isBiometricEnabled() {
  return localStorage.getItem(ENABLED_KEY) === "1" && Boolean(localStorage.getItem(CREDENTIAL_KEY));
}

// Registers a platform (biometric) credential and remembers its id locally.
// There's no backend here, so this only ever authenticates against this device.
export async function enableBiometric() {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: RP_NAME },
      user: { id: USER_ID, name: "meu-saldo", displayName: "Meu Saldo" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
      attestation: "none",
    },
  });
  if (!credential) throw new Error("Não foi possível criar a credencial biométrica.");
  localStorage.setItem(CREDENTIAL_KEY, bufferToBase64url(credential.rawId));
  localStorage.setItem(ENABLED_KEY, "1");
}

export function disableBiometric() {
  localStorage.removeItem(ENABLED_KEY);
  localStorage.removeItem(CREDENTIAL_KEY);
}

// Asks the OS to verify the user (fingerprint/face) against the stored credential.
// Resolves only after a successful biometric check; rejects otherwise.
export async function verifyBiometric() {
  const storedId = localStorage.getItem(CREDENTIAL_KEY);
  if (!storedId) throw new Error("Nenhuma credencial biométrica cadastrada.");
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: base64urlToBuffer(storedId), type: "public-key" }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  if (!assertion) throw new Error("Falha na verificação biométrica.");
  return true;
}
