import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { initBackup } from "./backup.js";
import "./style.css";

// Runs before the first render so it sees the data as it was on launch.
initBackup().catch((err) => console.warn("Backup em arquivo indisponível:", err));

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
