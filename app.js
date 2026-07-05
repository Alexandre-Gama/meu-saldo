(() => {
  "use strict";

  const STORAGE_KEY = "meu-saldo:v1";
  const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  /** @returns {{incomes: Array, expenses: Array}} */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { incomes: [], expenses: [] };
      const parsed = JSON.parse(raw);
      return {
        incomes: Array.isArray(parsed.incomes) ? parsed.incomes : [],
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      };
    } catch (err) {
      console.error("Não foi possível ler os dados salvos:", err);
      return { incomes: [], expenses: [] };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("Não foi possível salvar os dados:", err);
      alert("Não foi possível salvar. O armazenamento do navegador pode estar cheio ou bloqueado.");
    }
  }

  function parseAmount(raw) {
    let s = String(raw).trim().replace(/[^\d.,-]/g, "");
    if (s.includes(",")) {
      s = s.replace(/\./g, "").replace(",", ".");
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function makeId() {
    return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  let state = loadState();

  // --- DOM refs ---
  const balanceEl = document.getElementById("balance-amount");
  const totalIncomeEl = document.getElementById("total-income");
  const totalExpenseEl = document.getElementById("total-expense");
  const listIncomeEl = document.getElementById("list-income");
  const listExpenseEl = document.getElementById("list-expense");
  const emptyIncomeEl = document.getElementById("empty-income");
  const emptyExpenseEl = document.getElementById("empty-expense");

  const overlay = document.getElementById("sheet-overlay");
  const sheetForm = document.getElementById("sheet-form");
  const sheetTitle = document.getElementById("sheet-title");
  const inputDesc = document.getElementById("input-desc");
  const inputValue = document.getElementById("input-value");

  let activeType = "income";

  function sumOf(list) {
    return list.reduce((total, item) => total + item.value, 0);
  }

  function renderList(container, emptyEl, items) {
    container.innerHTML = "";
    emptyEl.style.display = items.length ? "none" : "block";
    for (const item of items) {
      const li = document.createElement("li");
      li.className = "ledger-item";

      const desc = document.createElement("span");
      desc.className = "desc";
      desc.textContent = item.desc;

      const val = document.createElement("span");
      val.className = "val";
      val.textContent = currency.format(item.value);

      const del = document.createElement("button");
      del.className = "del";
      del.type = "button";
      del.setAttribute("aria-label", `Remover ${item.desc}`);
      del.textContent = "×";
      del.addEventListener("click", () => removeItem(item.id));

      li.append(desc, val, del);
      container.appendChild(li);
    }
  }

  function render() {
    const incomeTotal = sumOf(state.incomes);
    const expenseTotal = sumOf(state.expenses);
    const balance = incomeTotal - expenseTotal;

    balanceEl.textContent = currency.format(balance);
    balanceEl.classList.toggle("positive", balance > 0);
    balanceEl.classList.toggle("negative", balance < 0);

    totalIncomeEl.textContent = currency.format(incomeTotal);
    totalExpenseEl.textContent = currency.format(expenseTotal);

    renderList(listIncomeEl, emptyIncomeEl, state.incomes);
    renderList(listExpenseEl, emptyExpenseEl, state.expenses);
  }

  function removeItem(id) {
    state.incomes = state.incomes.filter((i) => i.id !== id);
    state.expenses = state.expenses.filter((i) => i.id !== id);
    saveState();
    render();
  }

  function openSheet(type) {
    activeType = type;
    sheetTitle.textContent = type === "income" ? "Nova renda" : "Nova despesa";
    inputDesc.value = "";
    inputValue.value = "";
    overlay.classList.add("open");
    setTimeout(() => inputDesc.focus(), 50);
  }

  function closeSheet() {
    overlay.classList.remove("open");
  }

  document.querySelectorAll(".add-btn").forEach((btn) => {
    btn.addEventListener("click", () => openSheet(btn.dataset.type));
  });

  document.getElementById("btn-cancel").addEventListener("click", closeSheet);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeSheet();
  });

  sheetForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const desc = inputDesc.value.trim();
    const amount = parseAmount(inputValue.value);

    if (!desc) {
      inputDesc.focus();
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      inputValue.focus();
      inputValue.select();
      return;
    }

    const entry = { id: makeId(), desc, value: amount };
    if (activeType === "income") {
      state.incomes.push(entry);
    } else {
      state.expenses.push(entry);
    }
    saveState();
    render();
    closeSheet();
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    if (!state.incomes.length && !state.expenses.length) return;
    if (confirm("Apagar todos os lançamentos de renda e despesas deste aparelho?")) {
      state = { incomes: [], expenses: [] };
      saveState();
      render();
    }
  });

  render();

  // --- Offline support ---
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => {
        console.warn("Service worker não registrado (ok se aberto via arquivo local):", err);
      });
    });
  }
})();
