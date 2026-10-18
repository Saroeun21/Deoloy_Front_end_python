import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  BedDouble,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Landmark,
  List,
  Map,
  MapPin,
  Plane,
  Plus,
  RefreshCw,
  Sparkles,
  Sun,
  Trash2,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import { useTripStore } from "../../trips/store/useTripStore.jsx";

const OPEN_ASSISTANT_EVENT = "tripos:open-assistant";

function parseTripDate(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function tripDayCount(trip, items) {
  const start = parseTripDate(trip?.start_date);
  const end = parseTripDate(trip?.end_date);
  if (start && end && end >= start) {
    return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }
  return Math.max(1, ...items.map((item) => Number(item.day) || 1));
}

function formatDate(value, options = { month: "short", day: "numeric" }) {
  const date = parseTripDate(value);
  return date ? new Intl.DateTimeFormat(undefined, options).format(date) : "Date to be set";
}

function dateForDay(startDate, dayNumber) {
  const date = parseTripDate(startDate);
  if (!date) return "";
  date.setDate(date.getDate() + dayNumber - 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatMoney(value, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: /^[A-Za-z]{3}$/.test(currency) ? currency : "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return `${currency} ${(Number(value) || 0).toFixed(2)}`;
  }
}

function activityIcon(type = "") {
  const normalized = type.toLowerCase();
  if (/food|meal|dining|restaurant/.test(normalized)) return Utensils;
  if (/hotel|accommodation|stay|lodging/.test(normalized)) return BedDouble;
  if (/flight|transit|transport|transfer/.test(normalized)) return Plane;
  if (/ticket|landmark|sight|temple|museum|attraction/.test(normalized)) return Landmark;
  return MapPin;
}

function activityTone(type = "") {
  const normalized = type.toLowerCase();
  if (/food|meal|dining/.test(normalized)) return "bg-amber-50 text-amber-700";
  if (/hotel|accommodation|stay/.test(normalized)) return "bg-violet-50 text-violet-700";
  if (/flight|transit|transport/.test(normalized)) return "bg-sky-50 text-sky-700";
  if (/ticket|landmark|sight|temple|museum/.test(normalized)) return "bg-teal-50 text-teal-800";
  return "bg-slate-100 text-slate-600";
}

function activityLabel(type = "") {
  const labels = {
    activity: "Activity",
    food: "Food & dining",
    transport: "Transport",
    hotel: "Accommodation",
    free_time: "Free time",
    other: "Other",
  };
  return labels[type] || "Activity";
}

function formatTime(value) {
  if (!value) return "Time TBD";
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function ItineraryPage() {
  const {
    activeTrip,
    activeTripId,
    setActiveTripId,
    trips,
    itinerary,
    expenses,
    budget,
    loading,
    error: tripError,
    reload,
    addItineraryItem,
    deleteItineraryItem,
  } = useTripStore();
  const [selectedDay, setSelectedDay] = useState(1);
  const [view, setView] = useState("Timeline");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState("");
  const [form, setForm] = useState({
    title: "",
    type: "activity",
    time: "",
    cost: "",
    description: "",
  });

  const days = useMemo(
    () => (activeTrip ? tripDayCount(activeTrip, itinerary) : 0),
    [activeTrip, itinerary],
  );
  const dayNumber = Math.min(Math.max(1, selectedDay), Math.max(1, days));
  const dayDate = dateForDay(activeTrip?.start_date, dayNumber);
  const dayItems = useMemo(
    () =>
      itinerary
        .filter((item) => Number(item.day) === dayNumber)
        .slice()
        .sort((left, right) =>
          String(left.start_time || "99:99").localeCompare(
            String(right.start_time || "99:99"),
          ),
        ),
    [dayNumber, itinerary],
  );
  const daySpend = dayItems.reduce(
    (total, item) => total + (Number(item.estimated_cost) || 0),
    0,
  );
  const dailyLimit =
    days > 0 && String(activeTrip?.currency || "").toUpperCase() === "USD"
      ? (Number(budget.totalBudget) || 0) / days
      : 0;
  const dayExpenses = expenses.filter(
    (expense) =>
      String(expense.expense_date || "").slice(0, 10) === dayDate &&
      String(expense.currency || "").toUpperCase() === "USD",
  );
  const actualSpend = dayExpenses.reduce(
    (total, expense) => total + (Number(expense.amount) || 0),
    0,
  );
  const displayedSpend = daySpend || actualSpend;
  const remaining = Math.max(0, dailyLimit - displayedSpend);
  const progress = dailyLimit > 0
    ? Math.min(100, (displayedSpend / dailyLimit) * 100)
    : 0;
  const subtitle = activeTrip
    ? `${activeTrip.destination_name || activeTrip.destination || activeTrip.name} · ${days} ${days === 1 ? "day" : "days"}`
    : "Plan and manage your trip schedule";
  const tripIsLive = String(activeTrip?.status || "").toLowerCase() === "ongoing";

  async function handleSync() {
    setIsSyncing(true);
    setActionError("");
    try {
      await reload();
    } catch (syncError) {
      setActionError(
        syncError instanceof Error ? syncError.message : "Could not sync this trip.",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleAddActivity(event) {
    event.preventDefault();
    setIsSaving(true);
    setActionError("");
    try {
      await addItineraryItem({
        tripId: activeTripId,
        day: dayNumber,
        date: dayDate,
        title: form.title,
        type: form.type,
        time: form.time || null,
        cost: form.cost ? Number(form.cost) : 0,
        description: form.description,
      });
      setForm({ title: "", type: "activity", time: "", cost: "", description: "" });
      setIsFormOpen(false);
    } catch (saveError) {
      setActionError(
        saveError instanceof Error ? saveError.message : "Could not save this activity.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteActivity(item) {
    const confirmed = window.confirm(
      `Delete "${item.title}" from this itinerary? Any recorded expense will remain in your budget.`,
    );
    if (!confirmed) return;
    setDeletingItemId(String(item.id));
    setActionError("");
    try {
      await deleteItineraryItem(item.id);
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this activity.",
      );
    } finally {
      setDeletingItemId("");
    }
  }

  if (loading && !trips.length) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Loading your itinerary…
      </main>
    );
  }

  if (!activeTrip) {
    return (
      <main className="mx-auto flex min-h-[65vh] max-w-3xl flex-col items-center justify-center px-5 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-teal-50 text-teal-800">
          <CalendarDays size={28} />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-slate-900">Your itinerary starts with a trip</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          Create a trip or select one from My Trips to build its day-by-day schedule.
        </p>
        <Link
          className="mt-6 rounded-xl bg-teal-800 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-900"
          to="/trips"
        >
          Go to My Trips
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-50 px-4 py-5 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <label className="sr-only" htmlFor="itinerary-trip">Select trip</label>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Itinerary Schedule
              </h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                tripIsLive
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-200/70 text-slate-600"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${tripIsLive ? "bg-emerald-600" : "bg-slate-400"}`} />
                {tripIsLive ? "Live trip mode" : "Trip mode"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <p>{subtitle}</p>
              <span aria-hidden="true">·</span>
              <select
                className="max-w-56 truncate border-0 bg-transparent p-0 font-medium text-teal-800 outline-none"
                id="itinerary-trip"
                onChange={(event) => {
                  setActiveTripId(event.target.value);
                  setSelectedDay(1);
                }}
                value={activeTripId}
              >
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>{trip.name}</option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className="-ml-2 text-teal-800" size={14} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div aria-label="Itinerary view" className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="group">
              {[
                { name: "Timeline", icon: List },
                { name: "Calendar", icon: CalendarDays },
                { name: "Split map", icon: Map },
              ].map(({ name, icon: Icon }) => (
                <button
                  aria-pressed={view === name}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    view === name ? "bg-teal-800 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                  key={name}
                  onClick={() => setView(name)}
                  type="button"
                >
                  <Icon aria-hidden="true" size={15} />
                  <span className="hidden sm:inline">{name}</span>
                </button>
              ))}
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))}
              type="button"
            >
              <Sparkles aria-hidden="true" className="text-teal-700" size={16} />
              <span className="hidden sm:inline">AI Auto-Optimize</span>
              <span className="sm:hidden">AI Optimize</span>
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              disabled={isSyncing}
              onClick={() => void handleSync()}
              type="button"
            >
              <RefreshCw aria-hidden="true" className={isSyncing ? "animate-spin" : ""} size={16} />
              <span className="hidden sm:inline">{isSyncing ? "Syncing…" : "Report / Sync"}</span>
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-900"
              onClick={() => setIsFormOpen(true)}
              type="button"
            >
              <Plus aria-hidden="true" size={17} />
              Add Activity
            </button>
          </div>
        </header>

        {(tripError || actionError) && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            {actionError || tripError}
          </div>
        )}

        <nav aria-label="Trip days" className="mt-6 flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: days }, (_, index) => index + 1).map((day) => {
            const items = itinerary.filter((item) => Number(item.day) === day);
            const dayLabel = items[0]?.day_title || items[0]?.title;
            return (
              <button
                aria-current={day === dayNumber ? "date" : undefined}
                className={`min-w-56 flex-1 rounded-2xl border p-4 text-left transition ${
                  day === dayNumber
                    ? "border-teal-800 bg-teal-800 text-white shadow-md shadow-teal-900/10"
                    : "border-slate-200/80 bg-white text-slate-700 shadow-sm hover:border-teal-300"
                }`}
                key={day}
                onClick={() => setSelectedDay(day)}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-xs font-bold uppercase tracking-wide ${day === dayNumber ? "text-teal-100" : "text-slate-400"}`}>
                    Day {day} <span className="mx-1">·</span> {formatDate(dateForDay(activeTrip.start_date, day))}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${day === dayNumber ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {items.length} {items.length === 1 ? "step" : "steps"}
                  </span>
                </div>
                <p className="mt-2 truncate text-sm font-semibold">
                  {dayLabel || (day === 1 ? activeTrip.destination_name || activeTrip.name : "Plan this day")}
                </p>
                <p className={`mt-1 text-xs ${day === dayNumber ? "text-teal-100" : "text-slate-500"}`}>
                  {formatMoney(items.reduce((sum, item) => sum + (Number(item.estimated_cost) || 0), 0))}
                </p>
              </button>
            );
          })}
        </nav>

        {isFormOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) setIsFormOpen(false);
          }}>
            <form
              aria-labelledby="add-itinerary-title"
              className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
              onSubmit={handleAddActivity}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Day {dayNumber} · {formatDate(dayDate)}</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950" id="add-itinerary-title">Add an activity</h2>
                </div>
                <button aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" disabled={isSaving} onClick={() => setIsFormOpen(false)} type="button">
                  <X size={18} />
                </button>
              </div>
              <label className="mt-5 block text-sm font-medium text-slate-700">
                Activity name
                <input autoFocus className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600" onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} />
              </label>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">
                  Category
                  <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" onChange={(event) => setForm({ ...form, type: event.target.value })} value={form.type}>
                    <option value="activity">Activity</option>
                    <option value="food">Food & dining</option>
                    <option value="transport">Transport</option>
                    <option value="hotel">Accommodation</option>
                    <option value="free_time">Free time</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Start time
                  <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" onChange={(event) => setForm({ ...form, time: event.target.value })} type="time" value={form.time} />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Est. cost (USD)
                  <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" min="0" onChange={(event) => setForm({ ...form, cost: event.target.value })} step="0.01" type="number" value={form.cost} />
                </label>
              </div>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Notes
                <textarea className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600" onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} value={form.description} />
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <button className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100" disabled={isSaving} onClick={() => setIsFormOpen(false)} type="button">Cancel</button>
                <button className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-60" disabled={isSaving} type="submit">
                  {isSaving ? "Saving…" : <><Check size={16} /> Save activity</>}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(300px,0.95fr)]">
          <section className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-teal-900 to-teal-800 px-5 py-5 text-white sm:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100">
                    Day {dayNumber} summary · {formatDate(dayDate, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <h2 className="mt-1 text-xl font-bold">
                    {dayItems[0]?.day_title || activeTrip.destination_name || activeTrip.destination || activeTrip.name}
                  </h2>
                  <p className="mt-1 text-sm text-teal-100">{dayItems.length} planned {dayItems.length === 1 ? "activity" : "activities"}</p>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3">
                  <Sun aria-hidden="true" className="text-amber-200" size={23} />
                  <div>
                    <p className="text-xs text-teal-100">Trip overview</p>
                    <p className="font-semibold">{formatMoney(displayedSpend)} planned</p>
                  </div>
                </div>
              </div>

              {view === "Calendar" ? (
                <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: days }, (_, index) => index + 1).map((day) => {
                    const entries = itinerary.filter((item) => Number(item.day) === day);
                    return (
                      <button
                        className={`min-h-40 rounded-2xl border p-4 text-left transition ${day === dayNumber ? "border-teal-400 bg-teal-50/70" : "border-slate-200 hover:border-teal-300"}`}
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        type="button"
                      >
                        <p className="text-xs font-bold uppercase tracking-wide text-teal-800">Day {day} · {formatDate(dateForDay(activeTrip.start_date, day))}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{entries[0]?.day_title || entries[0]?.title || "No activities yet"}</p>
                        <div className="mt-3 space-y-2">
                          {entries.slice(0, 3).map((item) => (
                            <p className="truncate text-xs text-slate-600" key={item.id}>
                              <span className="mr-1.5 font-medium text-slate-400">{formatTime(item.start_time)}</span>{item.title}
                            </p>
                          ))}
                          {entries.length > 3 && <p className="text-xs text-teal-800">+{entries.length - 3} more</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={`p-5 sm:p-6 ${view === "Split map" ? "grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,0.75fr)]" : ""}`}>
                  <div>
                    {dayItems.length ? (
                      <ol className="relative space-y-4 before:absolute before:bottom-8 before:left-[7.35rem] before:top-7 before:w-px before:bg-slate-200 sm:before:left-[8.25rem]">
                        {dayItems.map((item) => {
                          const Icon = activityIcon(item.type);
                          return (
                            <li className="relative grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-4" key={item.id}>
                              <div className="pt-4 text-right">
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                                  <Clock3 aria-hidden="true" size={12} />
                                  {formatTime(item.start_time)}
                                </span>
                              </div>
                              <article className="relative rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:shadow-md">
                                <span className={`absolute -left-[2.05rem] top-5 z-10 grid h-7 w-7 place-items-center rounded-full border-4 border-white sm:-left-[2.55rem] ${activityTone(item.type)}`}>
                                  <Icon aria-hidden="true" size={13} />
                                </span>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${activityTone(item.type)}`}>
                                      {activityLabel(item.type)}
                                    </span>
                                    <h3 className="mt-2 text-sm font-bold text-slate-900">{item.title}</h3>
                                  </div>
                                  <button
                                    aria-label={`Delete ${item.title} from itinerary`}
                                    className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-50"
                                    disabled={deletingItemId === String(item.id)}
                                    onClick={() => void handleDeleteActivity(item)}
                                    title="Delete activity"
                                    type="button"
                                  >
                                    <Trash2 aria-hidden="true" size={16} />
                                  </button>
                                </div>
                                {item.description && <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>}
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  {item.estimated_cost != null && Number(item.estimated_cost) > 0 && (
                                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{formatMoney(item.estimated_cost)}</span>
                                  )}
                                  {item.status && (
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">{item.status}</span>
                                  )}
                                </div>
                              </article>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-center">
                        <CalendarDays className="mx-auto text-teal-700" size={25} />
                        <h3 className="mt-3 font-semibold text-slate-900">Nothing planned for this day yet</h3>
                        <p className="mt-1 text-sm text-slate-500">Add an activity to start building your schedule.</p>
                        <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900" onClick={() => setIsFormOpen(true)} type="button">
                          <Plus size={16} /> Add first activity
                        </button>
                      </div>
                    )}
                    <button
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm font-semibold text-slate-500 transition hover:border-teal-400 hover:bg-teal-50/50 hover:text-teal-800"
                      onClick={() => setIsFormOpen(true)}
                      type="button"
                    >
                      <Plus size={17} /> Drop next place or click to add activity
                    </button>
                  </div>
                  {view === "Split map" && (
                    <div className="min-h-64 overflow-hidden rounded-2xl border border-slate-200 bg-[#eaf3ed] p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Day {dayNumber} route</p>
                          <h3 className="mt-1 font-bold text-slate-900">{dayItems.length} stops</h3>
                        </div>
                        <Map aria-hidden="true" className="text-teal-700" size={18} />
                      </div>
                      <div className="relative mt-4 flex min-h-40 items-center justify-center overflow-hidden rounded-xl bg-[#dcebe2]">
                        <svg aria-hidden="true" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 400 220">
                          <path d="M36 178 C90 110 125 168 170 110 S260 80 288 112 S340 105 370 40" fill="none" stroke="#7ba892" strokeDasharray="7 7" strokeWidth="3" />
                          <path d="M0 62 C80 88 106 38 177 65 S284 45 400 84 M40 220 C75 175 108 190 152 162" fill="none" stroke="#c5d8cc" strokeWidth="14" />
                        </svg>
                        {dayItems.slice(0, 3).map((item, index) => {
                          const points = [
                            "left-[10%] bottom-[18%]",
                            "left-[43%] top-[35%]",
                            "right-[10%] top-[14%]",
                          ];
                          return (
                            <span className={`absolute ${points[index]} z-10 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-teal-800 text-xs font-bold text-white shadow-md`} key={item.id} title={item.title}>
                              {index + 1}
                            </span>
                          );
                        })}
                        {!dayItems.length && <span className="relative rounded-lg bg-white/80 px-3 py-2 text-xs text-slate-500">Add stops to preview your route</span>}
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">Route preview based on your scheduled stops. Add location details to plan travel between activities.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <section className="rounded-2xl bg-[#123f3a] p-5 text-white shadow-sm">
              <div className="flex items-center gap-2 text-teal-100">
                <Sparkles aria-hidden="true" size={17} />
                <p className="text-xs font-bold uppercase tracking-[0.13em]">AI route assistant</p>
              </div>
              <h2 className="mt-3 text-lg font-bold">Make the day flow better</h2>
              <p className="mt-2 text-sm leading-6 text-teal-50/85">
                Ask Komsan AI to review your stops, find a smoother order, and tailor suggestions to your trip.
              </p>
              <button
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-teal-900 transition hover:bg-teal-50"
                onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))}
                type="button"
              >
                Ask AI to optimize <ArrowRight size={15} />
              </button>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-400">Day overview</p>
                  <h2 className="mt-1 font-bold text-slate-900">Stops & timing</h2>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-700"><MapPin size={17} /></span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Activities</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{dayItems.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Planned spend</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{formatMoney(displayedSpend)}</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {dayItems.slice(0, 3).map((item, index) => (
                  <div className="flex min-w-0 items-center gap-3" key={item.id}>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-50 text-xs font-bold text-teal-800">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                      <p className="text-xs text-slate-400">{formatTime(item.start_time)}</p>
                    </div>
                    <ArrowDownRight className="shrink-0 text-slate-300" size={15} />
                  </div>
                ))}
                {!dayItems.length && <p className="text-sm text-slate-500">Your route stops will appear here.</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><Wallet size={17} /></span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-400">Day budget</p>
                    <h2 className="font-bold text-slate-900">Spend tracker</h2>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${dailyLimit === 0 || displayedSpend <= dailyLimit ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                  {dailyLimit === 0 || displayedSpend <= dailyLimit ? "On track" : "Over plan"}
                </span>
              </div>
              <div className="mt-5 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">{daySpend ? "Planned spend" : "Recorded spend"}</p>
                  <p className="mt-1 text-xl font-bold text-slate-950">{formatMoney(displayedSpend)}</p>
                </div>
                <p className="text-right text-xs text-slate-500">Daily guide<br /><strong className="text-slate-800">{dailyLimit ? formatMoney(dailyLimit) : "Not set in USD"}</strong></p>
              </div>
              <div aria-label={`${Math.round(progress)}% of daily budget`} className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(progress)}>
                <div className={`h-full rounded-full transition-all ${displayedSpend > dailyLimit && dailyLimit > 0 ? "bg-amber-500" : "bg-teal-700"}`} style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">{dailyLimit ? `${formatMoney(remaining)} remaining in daily guide` : String(activeTrip.currency || "").toUpperCase() === "USD" ? "Set a trip budget to see your daily guide." : `Trip budget is in ${activeTrip.currency}; it is not compared with USD itinerary costs.`}</p>
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                {[
                  {
                    label: "Food & dining",
                    matches: (type) => /food|meal|dining|restaurant/i.test(type),
                  },
                  {
                    label: "Transit",
                    matches: (type) => /transit|transport|flight/i.test(type),
                  },
                  {
                    label: "Other activities",
                    matches: (type) => !/food|meal|dining|restaurant|transit|transport|flight/i.test(type),
                  },
                ].map((category) => {
                  const total = dayItems
                    .filter((item) => category.matches(item.type || ""))
                    .reduce((sum, item) => sum + (Number(item.estimated_cost) || 0), 0);
                  return (
                    <div className="flex items-center justify-between text-xs" key={category.label}>
                      <span className="text-slate-500">{category.label}</span>
                      <span className="font-semibold text-slate-800">{formatMoney(total)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default ItineraryPage;
