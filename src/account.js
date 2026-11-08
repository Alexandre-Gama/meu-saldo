import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { clearIndexedDbPersistence, terminate, waitForPendingWrites } from "firebase/firestore";
import { auth, db } from "./firebase.js";

// undefined while Firebase is still working out whether someone is signed in,
// null when nobody is, the user otherwise.
export function useAuthUser() {
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}

export const MIN_PASSWORD_LENGTH = 8;

export function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export function signUp(email, password) {
  return createUserWithEmailAndPassword(auth, email.trim(), password);
}

export function sendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email.trim());
}

// Signs out and removes this user's data from the device, so the next person to
// use this browser doesn't find it in the offline cache. Reloads when done: a
// Firestore instance that was shut down can't be started again.
export async function signOutAndClear() {
  try {
    // Give changes that are still on their way a moment to reach the server.
    await Promise.race([waitForPendingWrites(db), new Promise((resolve) => setTimeout(resolve, 3000))]);
  } catch {
    // nothing else to do about it
  }
  await signOut(auth);
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (err) {
    console.warn("Não foi possível limpar o cache local:", err);
  }
  window.location.reload();
}

const AUTH_MESSAGES = {
  "auth/invalid-email": "Esse e-mail não parece válido.",
  "auth/missing-email": "Digite o seu e-mail.",
  "auth/missing-password": "Digite a sua senha.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Já existe uma conta com esse e-mail. Tente entrar.",
  "auth/weak-password": `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  "auth/user-disabled": "Essa conta foi desativada.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  "auth/network-request-failed": "Sem conexão com a internet. Tente de novo quando estiver online.",
  "auth/operation-not-allowed": "O login por e-mail e senha ainda não foi ativado no Firebase.",
  "auth/unauthorized-domain": "Este endereço não está autorizado no Firebase (Authentication › Configurações › Domínios autorizados).",
};

export function authErrorMessage(err) {
  return AUTH_MESSAGES[err?.code] ?? "Não foi possível concluir. Tente de novo.";
}

export function dataErrorMessage(err) {
  switch (err?.code) {
    case "permission-denied":
      return "O Firestore recusou o acesso. Confira se as regras de segurança foram publicadas (veja docs/firebase-setup.md).";
    case "unavailable":
      return "Não foi possível falar com o servidor. Verifique sua conexão.";
    case "failed-precondition":
      return "O Firestore ainda não está pronto neste projeto. Confira se o banco de dados foi criado.";
    default:
      return "Não foi possível carregar os seus dados.";
  }
}
