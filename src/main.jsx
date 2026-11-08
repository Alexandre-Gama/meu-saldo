import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { cleanUpOldBackupFeature } from "./legacy.js";
import "./style.css";

// The file-backup feature is gone (data lives in the account now); drop what it left in the browser.
cleanUpOldBackupFeature();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.warn("Service worker não registrado:", err);
    });
  });
}
