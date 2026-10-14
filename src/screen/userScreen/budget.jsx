import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../services/api/httpClient.js";
import budgetApi from "../../services/api/budgetapi.js";
import budgetCategoryApi from "../../services/api/budget_category_api.js";
import expenseApi from "../../services/api/expense_api.js";
import tripApi from "../../services/api/tripapi.js";
import tripWalletApi from "../../services/api/trip_wallet_api.js";
import walletApi from "../../services/api/walletapi.js";
import walletTransactionApi from "../../services/api/wallet_transaction_api.js";
import {
  ArrowDownUp,
  CalendarDays,
  CreditCard,
  Plus,
  Search,
  Wallet,
} from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
function formatMoney(value, currencyCode = "USD") {
  const currency = /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(value) || 0);
}

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

function Budget() {
  const [trips, setTrips] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [tripWallets, setTripWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [userId, setUserId] = useState(null);
  const [selectedTripId, setSelectedTripId] = useState("");
  const selectedTripIdRef = useRef(selectedTripId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryAllocation, setCategoryAllocation] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [fundAmount, setFundAmount] = useState("");
  const [personalWalletName, setPersonalWalletName] = useState("");
  const [personalWalletCurrency, setPersonalWalletCurrency] = useState("USD");
  const [activeMode, setActiveMode] = useState("overview");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("all");
  const [expenseDateFrom, setExpenseDateFrom] = useState("");
  const [expenseDateTo, setExpenseDateTo] = useState("");
  const [fxRate, setFxRate] = useState("");
  const [fxAmount, setFxAmount] = useState("1");
  const [fxCurrency, setFxCurrency] = useState("THB");
  const expenseFormRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const [
        tripsData,
        budgetsData,
        categoriesData,
        expensesData,
        tripWalletsData,
        transactionsData,
        walletsData,
        user,
      ] = await Promise.all([
        tripApi.list(),
        budgetApi.list(),
        budgetCategoryApi.list(),
        expenseApi.list(),
        tripWalletApi.list(),
        walletTransactionApi.list(),
        walletApi.fetchWalletData(),
        apiRequest("/users/me"),
      ]);

      setError("");
      setTrips(tripsData);
      setBudgets(budgetsData);
      setCategories(categoriesData);
      setExpenses(expensesData);
      setTripWallets(tripWalletsData);
      setTransactions(transactionsData);
      setWallets(walletsData);
      setUserId(user.id);
      const selectedTrip =
        tripsData.find(
          (trip) => String(trip.id) === String(selectedTripIdRef.current),
        ) || tripsData[0];
      const tripId = selectedTrip ? String(selectedTrip.id) : "";
      const tripBudget = budgetsData.find(
        (item) => String(item.trip_id) === tripId,
      );
      const tripCategories = categoriesData.filter(
        (item) => String(item.budget_id) === String(tripBudget?.id),
      );
      selectedTripIdRef.current = tripId;
      setSelectedTripId(tripId);
      setBudgetInput(
        String(tripBudget?.total_budget ?? selectedTrip?.budget_amount ?? ""),
      );
      setExpenseCategoryId(
        tripCategories.length ? String(tripCategories[0].id) : "",
      );
      setEditingExpenseId(null);
    } catch (loadError) {
      console.error("Failed to load budget and wallet data:", loadError);
      setError(getErrorMessage(loadError, "Could not load budget data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedTrip = trips.find(
    (trip) => String(trip.id) === String(selectedTripId),
  );
  const activeBudget = budgets.find(
    (item) => String(item.trip_id) === String(selectedTripId),
  );
  const activeCategories = categories.filter(
    (item) => String(item.budget_id) === String(activeBudget?.id),
  );
  const activeExpenses = expenses
    .filter((item) => String(item.trip_id) === String(selectedTripId))
    .sort((left, right) =>
      String(right.expense_date).localeCompare(String(left.expense_date)),
    );
  const activeTripWallet = tripWallets.find(
    (item) => String(item.trip_id) === String(selectedTripId),
  );
  const activeTransactions = transactions
    .filter((item) => String(item.wallet_id) === String(activeTripWallet?.id))
    .sort((left, right) =>
      String(right.transaction_date).localeCompare(String(left.transaction_date)),
    );

  const activeCurrency = "USD";
  const totalSpent = useMemo(
    () =>
      activeExpenses.reduce(
        (total, expense) => total + Number(expense.amount || 0),
        0,
      ),
    [activeExpenses],
  );
  const totalBudget = Number(
    activeBudget?.total_budget ?? selectedTrip?.budget_amount ?? budgetInput ?? 0,
  );
  const remaining = totalBudget - totalSpent;
  const spentPercent =
    totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const categoryTotals = activeCategories.map((category) => {
    const spent = activeExpenses
      .filter(
        (expense) =>
          String(expense.budget_category_id) === String(category.id),
      )
      .reduce((total, expense) => total + Number(expense.amount || 0), 0);
    return { ...category, spent };
  });
  const filteredExpenses = activeExpenses.filter((expense) => {
    const matchesSearch = `${expense.description || ""} ${expense.payment_method || ""}`
      .toLowerCase()
      .includes(expenseSearch.trim().toLowerCase());
    const matchesCategory =
      expenseCategoryFilter === "all" ||
      String(expense.budget_category_id) === expenseCategoryFilter;
    const expenseDay = String(expense.expense_date || "").slice(0, 10);
    const matchesFrom = !expenseDateFrom || expenseDay >= expenseDateFrom;
    const matchesTo = !expenseDateTo || expenseDay <= expenseDateTo;
    return matchesSearch && matchesCategory && matchesFrom && matchesTo;
  });
  const durationDays =
    selectedTrip?.start_date && selectedTrip?.end_date
      ? Math.max(
          1,
          Math.round(
            (new Date(`${selectedTrip.end_date}T00:00:00`).getTime() -
              new Date(`${selectedTrip.start_date}T00:00:00`).getTime()) /
              86_400_000,
          ) + 1,
        )
      : 1;
  const dailyAverage = totalSpent / durationDays;
  const allocationTotal = categoryTotals.reduce(
    (total, category) => total + Number(category.allocated_amount || 0),
    0,
  );
  const allocationColors = [
    "bg-teal-600",
    "bg-indigo-500",
    "bg-amber-400",
    "bg-sky-500",
    "bg-rose-400",
    "bg-violet-500",
  ];
  const hasFxRate = Number.isFinite(Number(fxRate)) && Number(fxRate) > 0;

  function navigateToMode(mode, targetId) {
    setActiveMode(mode);
    document.getElementById(targetId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function resetExpenseForm() {
    setExpenseName("");
    setExpenseAmount("");
    setExpenseDate(today());
    setPaymentMethod("Cash");
    setEditingExpenseId(null);
    setExpenseCategoryId(
      activeCategories.length ? String(activeCategories[0].id) : "",
    );
  }

  function selectTrip(tripId) {
    selectedTripIdRef.current = tripId;
    setSelectedTripId(tripId);
    const trip = trips.find((item) => String(item.id) === String(tripId));
    const tripBudget = budgets.find(
      (item) => String(item.trip_id) === String(tripId),
    );
    const tripCategories = categories.filter(
      (item) => String(item.budget_id) === String(tripBudget?.id),
    );
    setBudgetInput(
      String(tripBudget?.total_budget ?? trip?.budget_amount ?? ""),
    );
    resetExpenseForm();
    setExpenseCategoryId(
      tripCategories.length ? String(tripCategories[0].id) : "",
    );
  }

  async function saveBudget(event) {
    event.preventDefault();
    if (!selectedTrip) return;
    const amount = Number(budgetInput);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid budget amount.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const savedBudget = activeBudget
        ? await budgetApi.update(activeBudget.id, {
            total_budget: amount,
          currency: "USD",
          })
        : await budgetApi.create({
            trip_id: selectedTrip.id,
            total_budget: amount,
          currency: "USD",
          });
      setBudgets((current) => [
        ...current.filter((item) => item.id !== savedBudget.id),
        savedBudget,
      ]);

      if (activeTripWallet) {
        const updatedWallet = await tripWalletApi.update(activeTripWallet.id, {
          target_amount: amount,
          currency: "USD",
        });
        setTripWallets((current) =>
          current.map((item) =>
            item.id === updatedWallet.id ? updatedWallet : item,
          ),
        );
      }
      setNotice("Trip budget saved.");
    } catch (saveError) {
      console.error("Could not save trip budget:", saveError);
      setError(getErrorMessage(saveError, "Could not save trip budget."));
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(event) {
    event.preventDefault();
    if (!activeBudget) {
      setError("Save a budget for this trip before adding categories.");
      return;
    }
    const allocation = Number(categoryAllocation);
    if (!categoryName.trim() || !Number.isFinite(allocation) || allocation < 0) {
      setError("Enter a category name and a valid allocation.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const category = await budgetCategoryApi.create({
        budget_id: activeBudget.id,
        name: categoryName.trim(),
        allocated_amount: allocation,
      });
      setCategories((current) => [...current, category]);
      setExpenseCategoryId(String(category.id));
      setCategoryName("");
      setCategoryAllocation("");
      setNotice("Budget category added.");
    } catch (createError) {
      console.error("Could not add budget category:", createError);
      setError(getErrorMessage(createError, "Could not add category."));
    } finally {
      setBusy(false);
    }
  }

  async function ensureTripWallet() {
    if (activeTripWallet) {
      if (activeTripWallet.currency === "USD") return activeTripWallet;
      const updatedWallet = await tripWalletApi.update(activeTripWallet.id, {
        currency: "USD",
      });
      setTripWallets((current) =>
        current.map((item) =>
          item.id === updatedWallet.id ? updatedWallet : item,
        ),
      );
      return updatedWallet;
    }
    const createdWallet = await tripWalletApi.create({
      trip_id: selectedTrip.id,
      target_amount: totalBudget,
      current_amount: 0,
      currency: activeCurrency,
    });
    setTripWallets((current) => [...current, createdWallet]);
    return createdWallet;
  }

  async function addTripFunds(event) {
    event.preventDefault();
    const amount = Number(fundAmount);
    if (!userId || !selectedTrip || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount to add to the trip wallet.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const tripWallet = await ensureTripWallet();
      await walletTransactionApi.create({
        wallet_id: tripWallet.id,
        user_id: userId,
        type: "deposit",
        amount,
        source: "Trip wallet funding",
        description: "Funds added to trip wallet",
        transaction_date: today(),
      });
      setFundAmount("");
      await loadData();
      setNotice("Funds added to the trip wallet.");
    } catch (fundError) {
      console.error("Could not add trip wallet funds:", fundError);
      setError(getErrorMessage(fundError, "Could not add wallet funds."));
    } finally {
      setBusy(false);
    }
  }

  async function saveExpense(event) {
    event.preventDefault();
    if (!selectedTrip || !activeBudget) {
      setError("Create a budget for this trip before recording expenses.");
      return;
    }
    if (!activeTripWallet) {
      setError("Create a trip wallet and add funds before recording expenses.");
      return;
    }
    const amount = Number(expenseAmount);
    if (
      !expenseName.trim() ||
      !expenseCategoryId ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError("Complete all required expense fields.");
      return;
    }
    const existingExpense = activeExpenses.find(
      (expense) => String(expense.id) === String(editingExpenseId),
    );
    const linkedTransaction = transactions.find(
      (transaction) => transaction.source === `expense:${editingExpenseId}`,
    );
    const availableBalance =
      Number(activeTripWallet.current_amount || 0) +
      (linkedTransaction ? Number(linkedTransaction.amount || 0) : 0);
    if (!linkedTransaction && amount > Number(activeTripWallet.current_amount || 0)) {
      setError("Insufficient trip wallet funds. Add funds before this expense.");
      return;
    }
    if (linkedTransaction && amount > availableBalance) {
      setError("Insufficient trip wallet funds for this updated expense.");
      return;
    }

    const expenseData = {
      trip_id: selectedTrip.id,
      budget_category_id: Number(expenseCategoryId),
      wallet_id: activeTripWallet.id,
      description: expenseName.trim(),
      amount,
      currency: activeCurrency,
      expense_date: expenseDate,
      payment_method: paymentMethod,
    };

    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (editingExpenseId !== null && existingExpense) {
        await expenseApi.update(editingExpenseId, expenseData);
      } else {
        await expenseApi.create(expenseData);
      }
      resetExpenseForm();
      await loadData();
      setNotice("Expense and matching wallet withdrawal saved.");
    } catch (saveError) {
      console.error("Could not save expense:", saveError);
      setError(getErrorMessage(saveError, "Could not save expense."));
    } finally {
      setBusy(false);
    }
  }

  function startEditingExpense(expense) {
    setEditingExpenseId(expense.id);
    setExpenseName(expense.description);
    setExpenseAmount(String(expense.amount));
    setExpenseDate(String(expense.expense_date).slice(0, 10));
    setPaymentMethod(expense.payment_method || "Cash");
    setExpenseCategoryId(String(expense.budget_category_id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteExpense(expense) {
    if (
      !window.confirm(
        "Delete this expense? Its linked wallet withdrawal will be reversed.",
      )
    ) {
      return;
    }
    setDeletingExpenseId(expense.id);
    setError("");
    setNotice("");
    try {
      await expenseApi.remove(expense.id);
      if (String(editingExpenseId) === String(expense.id)) {
        resetExpenseForm();
      }
      await loadData();
      setNotice("Expense deleted and trip wallet balance restored.");
    } catch (deleteError) {
      console.error("Could not delete expense:", deleteError);
      setError(getErrorMessage(deleteError, "Could not delete expense."));
    } finally {
      setDeletingExpenseId(null);
    }
  }

  async function addPersonalWallet(event) {
    event.preventDefault();
    if (!personalWalletName.trim()) {
      setError("Enter a name for the wallet.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const wallet = await walletApi.createWallet({
        name: personalWalletName.trim(),
        balance: 0,
        currency: personalWalletCurrency,
      });
      setWallets((current) => [...current, wallet]);
      setPersonalWalletName("");
      setNotice("Personal wallet created.");
    } catch (createError) {
      console.error("Could not create personal wallet:", createError);
      setError(getErrorMessage(createError, "Could not create wallet."));
    } finally {
      setBusy(false);
    }
  }

  async function deletePersonalWallet(walletId) {
    if (!window.confirm("Delete this personal wallet?")) return;
    setBusy(true);
    setError("");
    try {
      await walletApi.deleteWallet(walletId);
      setWallets((current) => current.filter((item) => item.id !== walletId));
      setNotice("Personal wallet deleted.");
    } catch (deleteError) {
      console.error("Could not delete personal wallet:", deleteError);
      setError(getErrorMessage(deleteError, "Could not delete wallet."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-full bg-slate-50 p-6 text-slate-600 sm:p-8">
        <div className="mx-auto max-w-6xl" role="status">
          Loading trips, budgets, expenses, and wallets…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#f8fafc] p-5 text-slate-800 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
              <span aria-hidden="true">● </span>Financial control hub
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Budget &amp; Wallet
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Track expenses, manage your trip wallet, and keep category spending
              aligned with your travel budget.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {trips.length > 0 && (
              <label className="min-w-56 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Active trip
                <select
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-slate-800 shadow-sm"
                  onChange={(event) => selectTrip(event.target.value)}
                  value={selectedTripId}
                >
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-900"
              onClick={() => {
                expenseFormRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                document.getElementById("expense-description")?.focus({
                  preventScroll: true,
                });
              }}
              type="button"
            >
              <Plus aria-hidden="true" size={17} />
              Add new expense
            </button>
          </div>
        </header>

        {selectedTrip && (
          <nav
            aria-label="Budget sections"
            className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
          >
            {[
              ["overview", "Overview & ledger", "budget-overview"],
              ["group", "Group split", "group-ledger"],
              ["wallet", "Wallets", "trip-wallet"],
              ["currency", "Currency calculator", "currency-calculator"],
            ].map(([mode, label, target]) => (
              <button
                aria-current={activeMode === mode ? "page" : undefined}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeMode === mode
                    ? "bg-teal-50 text-teal-800"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
                key={mode}
                onClick={() => navigateToMode(mode, target)}
                type="button"
              >
                {label}
                {mode === "group" && (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                    Not set up
                  </span>
                )}
              </button>
            ))}
          </nav>
        )}

        {error && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            <span>{error}</span>
            <button
              className="font-semibold underline"
              onClick={() => {
                setLoading(true);
                void loadData();
              }}
              type="button"
            >
              Reload data
            </button>
          </div>
        )}
        {notice && (
          <p
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            role="status"
          >
            {notice}
          </p>
        )}

        {trips.length === 0 ? (
          <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-bold">Create a trip to start budgeting</h2>
            <p className="mt-2 text-sm text-slate-500">
              Budgets, categories, expenses, and trip wallets are attached to a trip.
            </p>
            <a
              className="mt-5 inline-flex rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white"
              href="/trips"
            >
              Go to My Trips
            </a>
          </section>
        ) : selectedTrip ? (
          <>
            <section
              aria-label="Trip budget overview"
              className="scroll-mt-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7"
              id="budget-overview"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">
                    Budget overview
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">
                    {selectedTrip.name}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Trip budget and expenses are shown in US dollars (USD).
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    remaining >= 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {remaining >= 0 ? "On track" : "Over budget"}
                </span>
              </div>
              <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">Total trip budget</p>
                  <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                    {formatMoney(totalBudget, activeCurrency)}
                  </p>
                </div>
                <form className="flex gap-2" onSubmit={saveBudget}>
                  <label className="sr-only" htmlFor="trip-budget-amount">
                    Trip budget amount
                  </label>
                  <input
                    className="w-36 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    id="trip-budget-amount"
                    min="0"
                    onChange={(event) => setBudgetInput(event.target.value)}
                    step="0.01"
                    type="number"
                    value={budgetInput}
                  />
                  <button
                    className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                    disabled={busy}
                    type="submit"
                  >
                    Save budget
                  </button>
                </form>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="flex h-full w-full">
                  {categoryTotals.map((category, index) => {
                    const share =
                      allocationTotal > 0
                        ? (Number(category.allocated_amount || 0) /
                            allocationTotal) *
                          100
                        : 0;
                    return (
                      <span
                        className={`${allocationColors[index % allocationColors.length]} first:rounded-l-full last:rounded-r-full`}
                        key={category.id}
                        style={{ width: `${share}%` }}
                        title={`${category.name}: ${formatMoney(category.allocated_amount, activeCurrency)}`}
                      />
                    );
                  })}
                </div>
              </div>
              {categoryTotals.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                  {categoryTotals.map((category, index) => (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs text-slate-500"
                      key={category.id}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${allocationColors[index % allocationColors.length]}`}
                      />
                      {category.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Total budget", formatMoney(totalBudget, activeCurrency)],
                  [
                    "Spent so far",
                    `${formatMoney(totalSpent, activeCurrency)} · ${Math.round(spentPercent)}%`,
                  ],
                  ["Remaining", formatMoney(remaining, activeCurrency)],
                  ["Daily average", `${formatMoney(dailyAverage, activeCurrency)} / day`],
                ].map(([label, value], index) => (
                  <article
                    className={`rounded-2xl p-4 ${
                      index === 2 ? "bg-teal-800 text-white" : "bg-slate-50"
                    }`}
                    key={label}
                  >
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        index === 2 ? "text-teal-100" : "text-slate-500"
                      }`}
                    >
                      {label}
                    </p>
                    <p className="mt-2 text-xl font-bold">{value}</p>
                  </article>
                ))}
              </div>
              {totalBudget > 0 && (
                <p className="mt-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900">
                  <span aria-hidden="true">💡 </span>
                  You have used {Math.round(spentPercent)}% of the saved trip budget.
                  {categoryTotals.length === 0 &&
                    " Add budget categories to see how your allocations are distributed."}
                </p>
              )}
            </section>

            <section className="grid scroll-mt-6 gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-950">
                        Recent transactions
                      </h2>
                      <p className="text-sm text-slate-500">
                        Expense records and their linked trip-wallet withdrawals.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {filteredExpenses.length} of {activeExpenses.length}
                    </span>
                  </div>

                  <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <label className="relative">
                      <Search
                        aria-hidden="true"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={16}
                      />
                      <input
                        aria-label="Search expenses"
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-600"
                        onChange={(event) => setExpenseSearch(event.target.value)}
                        placeholder="Search transactions"
                        type="search"
                        value={expenseSearch}
                      />
                    </label>
                    <label>
                      <span className="sr-only">Filter by category</span>
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                        onChange={(event) =>
                          setExpenseCategoryFilter(event.target.value)
                        }
                        value={expenseCategoryFilter}
                      >
                        <option value="all">All categories</option>
                        {activeCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-2">
                      <CalendarDays
                        aria-hidden="true"
                        className="shrink-0 text-slate-400"
                        size={15}
                      />
                      <input
                        aria-label="Expenses from date"
                        className="min-w-0 py-2 text-xs text-slate-600 outline-none"
                        onChange={(event) => setExpenseDateFrom(event.target.value)}
                        type="date"
                        value={expenseDateFrom}
                      />
                      <span className="text-xs text-slate-400">to</span>
                      <input
                        aria-label="Expenses to date"
                        className="min-w-0 py-2 text-xs text-slate-600 outline-none"
                        onChange={(event) => setExpenseDateTo(event.target.value)}
                        type="date"
                        value={expenseDateTo}
                      />
                    </div>
                  </div>

                  {filteredExpenses.length ? (
                    <ul className="divide-y divide-slate-100">
                      {filteredExpenses.map((expense) => {
                        const category = activeCategories.find(
                          (item) =>
                            String(item.id) ===
                            String(expense.budget_category_id),
                        );
                        const isLinked = transactions.some(
                          (item) => item.source === `expense:${expense.id}`,
                        );
                        return (
                          <li
                            className="flex flex-wrap items-start justify-between gap-4 py-4"
                            key={expense.id}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold">
                                {expense.description}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {category?.name || "Uncategorized"} ·{" "}
                                {expense.payment_method || "Payment method not set"} ·{" "}
                                {expense.expense_date}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {isLinked
                                  ? "Trip wallet withdrawal recorded"
                                  : "Legacy expense without linked wallet transaction"}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <strong>
                                {formatMoney(expense.amount, "USD")}
                              </strong>
                              <div className="flex gap-2">
                                <button
                                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold"
                                  onClick={() => startEditingExpense(expense)}
                                  type="button"
                                >
                                  Edit
                                </button>
                                <button
                                  className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                                  disabled={deletingExpenseId === expense.id}
                                  onClick={() => void deleteExpense(expense)}
                                  type="button"
                                >
                                  {deletingExpenseId === expense.id
                                    ? "Deleting…"
                                    : "Delete"}
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                      {activeExpenses.length
                        ? "No transactions match these filters."
                        : "No expenses for this trip yet."}
                    </p>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-bold text-slate-950">
                    Category breakdown
                  </h2>
                  <ul className="mt-4 space-y-4">
                    {categoryTotals.map((category) => {
                      const percent =
                        Number(category.allocated_amount) > 0
                          ? Math.min(
                              (category.spent /
                                Number(category.allocated_amount)) *
                                100,
                              100,
                            )
                          : 0;
                      return (
                        <li key={category.id}>
                          <div className="mb-1.5 flex justify-between gap-3 text-sm">
                            <span>{category.name}</span>
                            <span className="text-slate-500">
                              {formatMoney(category.spent, activeCurrency)} /{" "}
                              {formatMoney(category.allocated_amount, activeCurrency)}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-teal-600"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                    {!categoryTotals.length && (
                      <li className="text-sm text-slate-500">
                        Add a category to start tracking category allocations.
                      </li>
                    )}
                  </ul>
                  <form
                    className="mt-5 grid gap-3 sm:grid-cols-[1fr_10rem_auto]"
                    onSubmit={addCategory}
                  >
                    <input
                      aria-label="New category name"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      onChange={(event) => setCategoryName(event.target.value)}
                      placeholder="Category name"
                      value={categoryName}
                    />
                    <input
                      aria-label="Category budget allocation"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      min="0"
                      onChange={(event) =>
                        setCategoryAllocation(event.target.value)
                      }
                      placeholder="Allocation"
                      step="0.01"
                      type="number"
                      value={categoryAllocation}
                    />
                    <button
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={busy || !activeBudget}
                      type="submit"
                    >
                      Add category
                    </button>
                  </form>
                  {!activeBudget && (
                    <p className="mt-2 text-xs text-amber-700">
                      Save a trip budget before adding categories.
                    </p>
                  )}
                </section>

                <section
                  className="scroll-mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                  id="currency-calculator"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-xl bg-indigo-50 p-2 text-indigo-700">
                      <ArrowDownUp aria-hidden="true" size={18} />
                    </span>
                    <div>
                      <h2 className="text-lg font-bold text-slate-950">
                        Currency calculator
                      </h2>
                      <p className="text-xs text-slate-500">
                        Enter a rate to calculate; no live FX feed is connected.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
                    <label className="text-xs font-semibold text-slate-500">
                      1 {activeCurrency} equals ({fxCurrency})
                      <input
                        aria-label={`Exchange rate, units of destination currency per ${activeCurrency}`}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-600"
                        min="0.000001"
                        onChange={(event) => setFxRate(event.target.value)}
                        placeholder="Enter exchange rate"
                        step="any"
                        type="number"
                        value={fxRate}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-500">
                      Amount
                      <input
                        aria-label={`Amount in ${activeCurrency}`}
                        className="mt-1.5 w-28 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-600"
                        min="0"
                        onChange={(event) => setFxAmount(event.target.value)}
                        step="any"
                        type="number"
                        value={fxAmount}
                      />
                    </label>
                  </div>
                  <label className="mt-3 block text-xs font-semibold text-slate-500">
                    Destination currency
                    <select
                      aria-label="Destination currency"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
                      onChange={(event) => setFxCurrency(event.target.value)}
                      value={fxCurrency}
                    >
                      {["THB", "USD", "EUR", "GBP", "KHR", "JPY"].map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="mt-3 rounded-xl bg-indigo-50/70 px-3 py-3 text-sm text-indigo-950">
                    {hasFxRate
                      ? `${formatMoney(Number(fxAmount) * Number(fxRate), fxCurrency)} at your entered rate (${fxRate} ${fxCurrency} per 1 ${activeCurrency}).`
                      : "Add an exchange rate above to calculate an estimated conversion."}
                  </p>
                </section>

              </div>

              <div className="space-y-6">
                <section
                  className="scroll-mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                  ref={expenseFormRef}
                >
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">
                      {editingExpenseId !== null ? "Edit expense" : "Add an expense"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Expenses are linked to the selected trip budget category and wallet.
                    </p>
                  </div>
                  {activeTripWallet && (
                    <p className="mt-3 rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900">
                      Wallet available:{" "}
                      <strong>
                        {formatMoney(
                          activeTripWallet.current_amount,
                          "USD",
                        )}
                      </strong>
                    </p>
                  )}
                  <form className="mt-4 space-y-3" onSubmit={saveExpense}>
                    <label className="block text-sm font-medium text-slate-600">
                      Expense name
                      <input
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        id="expense-description"
                        onChange={(event) => setExpenseName(event.target.value)}
                        placeholder="e.g. Museum tickets"
                        required
                        value={expenseName}
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-600">
                      Budget category
                      <select
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                        onChange={(event) =>
                          setExpenseCategoryId(event.target.value)
                        }
                        required
                        value={expenseCategoryId}
                      >
                        <option value="">Choose a category</option>
                        {activeCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-sm font-medium text-slate-600">
                        Amount ({activeCurrency})
                        <input
                          className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                          min="0.01"
                          onChange={(event) =>
                            setExpenseAmount(event.target.value)
                          }
                          required
                          step="0.01"
                          type="number"
                          value={expenseAmount}
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-600">
                        Date
                        <input
                          className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                          onChange={(event) => setExpenseDate(event.target.value)}
                          required
                          type="date"
                          value={expenseDate}
                        />
                      </label>
                    </div>
                    <label className="block text-sm font-medium text-slate-600">
                      Payment method
                      <select
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                        onChange={(event) =>
                          setPaymentMethod(event.target.value)
                        }
                        value={paymentMethod}
                      >
                        {["Cash", "Card", "Bank transfer", "Other"].map(
                          (method) => (
                            <option key={method} value={method}>
                              {method}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <button
                        className="flex-1 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        disabled={
                          busy ||
                          !activeBudget ||
                          !activeTripWallet ||
                          !activeCategories.length
                        }
                        type="submit"
                      >
                        {busy
                          ? "Saving…"
                          : editingExpenseId !== null
                            ? "Update expense"
                            : "Add expense & withdraw"}
                      </button>
                      {editingExpenseId !== null && (
                        <button
                          className="rounded-xl bg-slate-100 px-4 text-sm font-semibold"
                          onClick={resetExpenseForm}
                          type="button"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    {!activeBudget && (
                      <p className="text-xs text-amber-700">
                        Save the trip budget first.
                      </p>
                    )}
                    {!activeTripWallet && (
                      <p className="text-xs text-amber-700">
                        Create the trip wallet in the funding panel first.
                      </p>
                    )}
                    {!activeCategories.length && (
                      <p className="text-xs text-amber-700">
                        Add at least one budget category first.
                      </p>
                    )}
                  </form>
                </section>

                <section
                  className="scroll-mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                  id="trip-wallet"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-xl bg-teal-50 p-2 text-teal-800">
                      <Wallet aria-hidden="true" size={18} />
                    </span>
                    <div>
                      <h2 className="text-lg font-bold text-slate-950">
                        Trip wallet
                      </h2>
                      <p className="text-xs text-slate-500">
                        Real balance from your trip wallet
                      </p>
                    </div>
                  </div>
                  {activeTripWallet ? (
                    <>
                      <p className="mt-2 text-2xl font-bold">
                        {formatMoney(
                          activeTripWallet.current_amount,
                          "USD",
                        )}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Target:{" "}
                        {formatMoney(
                          activeTripWallet.target_amount,
                          "USD",
                        )}
                      </p>
                      <form
                        className="mt-4 flex gap-2"
                        onSubmit={addTripFunds}
                      >
                        <input
                          aria-label="Amount to add to trip wallet"
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          min="0.01"
                          onChange={(event) => setFundAmount(event.target.value)}
                          placeholder="Add funds"
                          required
                          step="0.01"
                          type="number"
                          value={fundAmount}
                        />
                        <button
                          className="rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          disabled={busy}
                          type="submit"
                        >
                          Deposit
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="mt-3">
                      <p className="text-sm text-slate-500">
                        A trip wallet is needed to fund expenses and record withdrawals.
                      </p>
                      <button
                        className="mt-3 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError("");
                          try {
                            await ensureTripWallet();
                            setNotice("Trip wallet created. Add funds to begin.");
                          } catch (createError) {
                            setError(
                              getErrorMessage(
                                createError,
                                "Could not create trip wallet.",
                              ),
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                        type="button"
                      >
                        Create trip wallet
                      </button>
                    </div>
                  )}
                  <h3 className="mt-5 text-sm font-bold">Wallet activity</h3>
                  {activeTransactions.length ? (
                    <ul className="mt-2 divide-y divide-slate-100">
                      {activeTransactions.slice(0, 8).map((transaction) => (
                        <li
                          className="flex justify-between gap-3 py-2 text-xs"
                          key={transaction.id}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {transaction.description || transaction.source || "Transaction"}
                            </span>
                            <span className="text-slate-500">
                              {transaction.transaction_date} · {transaction.type}
                            </span>
                          </span>
                          <span
                            className={
                              transaction.type === "deposit"
                                ? "font-semibold text-emerald-700"
                                : "font-semibold text-slate-700"
                            }
                          >
                            {transaction.type === "deposit" ? "+" : "−"}
                            {formatMoney(
                              transaction.amount,
                              "USD",
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      No wallet transactions for this trip yet.
                    </p>
                  )}
                </section>

              </div>
            </section>

            <section
              className="scroll-mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6"
              id="group-ledger"
            >
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-slate-100 p-2 text-slate-500">
                  <CreditCard aria-hidden="true" size={18} />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Group ledger &amp; payment methods
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                    This backend currently provides individual trip expenses,
                    trip-wallet activity, and personal wallets. Shared member
                    balances, settlement actions, and stored card details are
                    not available here, so this dashboard does not display
                    invented split amounts or card numbers.
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : null}

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Personal wallets</h2>
              <p className="mt-1 text-sm text-slate-500">
                Account wallets are separate from trip wallets and their ledgers.
              </p>
            </div>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={addPersonalWallet}
            >
              <input
                aria-label="Personal wallet name"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                onChange={(event) => setPersonalWalletName(event.target.value)}
                placeholder="Wallet name"
                value={personalWalletName}
              />
              <select
                aria-label="Personal wallet currency"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                onChange={(event) =>
                  setPersonalWalletCurrency(event.target.value)
                }
                value={personalWalletCurrency}
              >
                {["USD", "EUR", "GBP", "KHR", "JPY"].map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={busy}
                type="submit"
              >
                Create wallet
              </button>
            </form>
          </div>
          {wallets.length ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {wallets.map((wallet) => (
                <li
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"
                  key={wallet.id}
                >
                  <div>
                    <p className="font-semibold">{wallet.name}</p>
                    <p className="text-sm text-slate-500">
                      {formatMoney(wallet.balance, wallet.currency)}
                    </p>
                  </div>
                  <button
                    aria-label={`Delete ${wallet.name}`}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void deletePersonalWallet(wallet.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              No personal wallets yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

export default Budget;
