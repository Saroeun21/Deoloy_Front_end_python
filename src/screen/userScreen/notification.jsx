import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  BellRing,
  CalendarDays,
  Check,
  CheckCheck,
  Clock3,
  Image,
  LoaderCircle,
  MapPin,
  Plane,
  Plus,
  Sparkles,
  Trash2,
  UsersRound,
  Wallet,
} from "lucide-react";
import notificationApi from "../../services/api/notificationapi.js";
import reminderApi from "../../services/api/reminderapi.js";
import tripApi from "../../services/api/tripapi.js";
import userApi from "../../services/api/userApi.js";
import { useAuth } from "../../app/providers/authContext.js";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getNotificationPresentation(item, isReminder) {
  if (isReminder || item.reminder_id) {
    return {
      icon: CalendarDays,
      iconClass: "bg-teal-50 text-teal-700",
      label: isReminder ? "Trip reminder" : "Reminder update",
    };
  }

  const type = String(item.type || "").toLowerCase();
  if (type.includes("photo") || type.includes("memory")) {
    return { icon: Image, iconClass: "bg-teal-50 text-teal-700", label: "Shared memory" };
  }
  if (type.includes("budget") || type.includes("payment") || type.includes("expense")) {
    return { icon: Wallet, iconClass: "bg-teal-50 text-teal-700", label: "Trip spending" };
  }
  if (type.includes("itinerary") || type.includes("flight") || type.includes("trip")) {
    return { icon: Plane, iconClass: "bg-teal-50 text-teal-700", label: "Trip update" };
  }
  return { icon: BellRing, iconClass: "bg-teal-50 text-teal-700", label: item.type || "Notification" };
}

function NotificationAvatar({ item, isReminder, presentation }) {
  const name = item.actor_name || item.user_name || item.sender_name || "";
  const initials = name
    ? name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
    : "";
  const imageUrl = item.actor_avatar || item.avatar_url || item.user_avatar || item.image_url;
  const Icon = presentation.icon;

  if (imageUrl) {
    return (
      <img
        alt={name ? `${name}'s avatar` : ""}
        className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white"
        src={imageUrl}
      />
    );
  }
  if (initials) {
    return (
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 ring-2 ring-white">
        {initials}
      </span>
    );
  }
  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ring-2 ring-white ${presentation.iconClass}`}>
      <Icon size={18} />
      {isReminder && <span className="sr-only">Reminder</span>}
    </span>
  );
}

function Notification() {
  const { accessToken } = useAuth();
  const [accountProfile, setAccountProfile] = useState({
    accessToken: "",
    email: "",
  });
  const [notifications, setNotifications] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [trips, setTrips] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [creatingReminder, setCreatingReminder] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [newReminder, setNewReminder] = useState({
    tripId: "",
    title: "",
    description: "",
    dueDate: "",
    type: "custom",
  });
  const [error, setError] = useState("");
  const accountEmail =
    accountProfile.accessToken === accessToken ? accountProfile.email : "";

  const loadNotifications = useCallback(async () => {
    try {
      const [data, reminderData, tripData] = await Promise.all([
        notificationApi.list(),
        reminderApi.list(),
        tripApi.list(),
      ]);
      setNotifications(
        [...data].sort(
          (left, right) =>
            new Date(right.created_at).getTime() -
            new Date(left.created_at).getTime(),
        ),
      );
      setReminders(
        [...reminderData].sort(
          (left, right) =>
            new Date(left.due_date).getTime() -
            new Date(right.due_date).getTime(),
        ),
      );
      setTrips(tripData);
      setNewReminder((current) => ({
        ...current,
        tripId: current.tripId || (tripData.length ? String(tripData[0].id) : ""),
      }));
      setError("");
    } catch (loadError) {
      console.error("Could not load notifications:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load notifications.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accessToken) void loadNotifications();
  }, [accessToken, loadNotifications]);

  useEffect(() => {
    if (!accessToken) return undefined;
    let active = true;
    userApi
      .getCurrentUser()
      .then((user) => {
        if (active) setAccountProfile({ accessToken, email: user.email });
      })
      .catch((profileError) => {
        console.error("Could not load the signed-in email:", profileError);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read,
  ).length;
  const pendingReminderCount = reminders.filter(
    (reminder) => reminder.status === "pending",
  ).length;
  const upcomingReminders = reminders
    .filter((reminder) => reminder.status === "pending")
    .sort((left, right) => new Date(left.due_date) - new Date(right.due_date))
    .slice(0, 3);
  const peopleInUpdates = Array.from(
    new Map(
      notifications
        .filter((item) => item.actor_name || item.user_name || item.sender_name)
        .map((item) => {
          const name = item.actor_name || item.user_name || item.sender_name;
          return [name, {
            name,
            avatar: item.actor_avatar || item.avatar_url || item.user_avatar || item.image_url,
          }];
        }),
    ).values(),
  ).slice(0, 4);
  const visibleItems = useMemo(() => {
    const linkedReminderIds = new Set(
      notifications
        .map((notification) => notification.reminder_id)
        .filter((id) => id !== null && id !== undefined)
        .map(String),
    );
    const reminderItems = reminders
      .filter((reminder) => !linkedReminderIds.has(String(reminder.id)))
      .map((reminder) => ({ ...reminder, itemType: "reminder" }));
    const notificationItems = notifications
      .filter((notification) => filter !== "unread" || !notification.is_read)
      .map((notification) => ({ ...notification, itemType: "notification" }));
    const items =
      filter === "reminders"
        ? [...notifications
            .filter((notification) => notification.reminder_id)
            .map((notification) => ({
              ...notification,
              itemType: "notification",
            })), ...reminderItems]
        : filter === "unread"
          ? notificationItems
          : [...notificationItems, ...reminderItems];
    return items.sort((left, right) => {
      const leftDate =
        left.itemType === "reminder" ? left.due_date : left.created_at;
      const rightDate =
        right.itemType === "reminder" ? right.due_date : right.created_at;
      return new Date(rightDate).getTime() - new Date(leftDate).getTime();
    });
  }, [filter, notifications, reminders]);

  async function markAsRead(notification) {
    if (notification.is_read) return;
    setBusyId(notification.id);
    setError("");
    try {
      const updated = await notificationApi.markAsRead(notification.id);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? updated : item,
        ),
      );
    } catch (updateError) {
      console.error("Could not mark notification as read:", updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update notification.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function markAllAsRead() {
    const unread = notifications.filter((item) => !item.is_read);
    if (!unread.length) return;
    setMarkingAll(true);
    setError("");
    const updatedIds = [];
    try {
      for (const notification of unread) {
        await notificationApi.markAsRead(notification.id);
        updatedIds.push(notification.id);
      }
      const readIds = new Set(updatedIds);
      setNotifications((current) =>
        current.map((item) =>
          readIds.has(item.id) ? { ...item, is_read: true } : item,
        ),
      );
    } catch (updateError) {
      console.error("Could not mark all notifications as read:", updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update notifications.",
      );
      if (updatedIds.length) {
        const readIds = new Set(updatedIds);
        setNotifications((current) =>
          current.map((item) =>
            readIds.has(item.id) ? { ...item, is_read: true } : item,
          ),
        );
      }
    } finally {
      setMarkingAll(false);
    }
  }

  async function deleteNotification(notificationId) {
    setBusyId(notificationId);
    setError("");
    try {
      await notificationApi.remove(notificationId);
      setNotifications((current) =>
        current.filter((item) => item.id !== notificationId),
      );
    } catch (deleteError) {
      console.error("Could not delete notification:", deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete notification.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function completeReminder(reminder) {
    const busyKey = `reminder:${reminder.id}`;
    setBusyId(busyKey);
    setError("");
    try {
      const updated = await reminderApi.update(reminder.id, {
        status: "completed",
      });
      setReminders((current) =>
        current.map((item) =>
          item.id === reminder.id ? updated : item,
        ),
      );
    } catch (updateError) {
      console.error("Could not complete reminder:", updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update reminder.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function deleteReminder(reminder) {
    const busyKey = `reminder:${reminder.id}`;
    setBusyId(busyKey);
    setError("");
    try {
      await reminderApi.remove(reminder.id);
      setReminders((current) =>
        current.filter((item) => item.id !== reminder.id),
      );
      setNotifications((current) =>
        current.filter((item) => String(item.reminder_id) !== String(reminder.id)),
      );
    } catch (deleteError) {
      console.error("Could not delete reminder:", deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete reminder.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function createReminder(event) {
    event.preventDefault();
    const dueDate = new Date(newReminder.dueDate);
    if (
      !newReminder.tripId ||
      !newReminder.title.trim() ||
      !newReminder.dueDate ||
      Number.isNaN(dueDate.getTime())
    ) {
      setError("Choose a trip, enter a title, and set a valid due date.");
      return;
    }

    setCreatingReminder(true);
    setError("");
    try {
      const reminder = await reminderApi.create({
        trip_id: Number(newReminder.tripId),
        title: newReminder.title.trim(),
        description: newReminder.description.trim() || null,
        due_date: dueDate.toISOString(),
        type: newReminder.type,
        status: "pending",
      });
      setReminders((current) =>
        [...current, reminder].sort(
          (left, right) =>
            new Date(left.due_date).getTime() -
            new Date(right.due_date).getTime(),
        ),
      );
      setNewReminder((current) => ({
        ...current,
        title: "",
        description: "",
        dueDate: "",
      }));
      setShowReminderForm(false);
    } catch (createError) {
      console.error("Could not create reminder:", createError);
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create reminder.",
      );
    } finally {
      setCreatingReminder(false);
    }
  }

  if (!accessToken) {
    return (
      <main className="flex min-h-full items-center justify-center bg-slate-50 p-6">
        <section className="max-w-md rounded-2xl bg-white p-7 text-center shadow-sm ring-1 ring-slate-200">
          <Bell className="mx-auto text-teal-700" size={30} />
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            Sign in to view notifications
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Trip updates and reminders are private to your account.
          </p>
          <a
            className="mt-5 inline-flex rounded-xl bg-teal-800 px-5 py-3 text-sm font-semibold text-white"
            href="/login"
          >
            Sign in
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-50 p-5 text-slate-800 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="relative flex flex-col gap-4 overflow-hidden rounded-3xl bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 p-6 text-white shadow-xl sm:flex-row sm:items-end sm:justify-between sm:p-10">
          <div aria-hidden="true" className="absolute -bottom-10 -right-10 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" />
          <div className="relative z-10 max-w-xl">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-teal-200">
              <BellRing size={12} /> Your travel circle
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
              Notifications
            </h1>
            <p className="mt-2 text-sm text-teal-100/80">
              The little updates that keep your people and your plans in sync.
            </p>
          </div>
          <div className="relative z-10 flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-teal-900 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setShowReminderForm((current) => !current)}
              type="button"
            >
              <Plus size={15} />
              <span>Add reminder</span>
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={unreadCount === 0 || markingAll || filter === "reminders"}
              onClick={() => void markAllAsRead()}
              type="button"
            >
              {markingAll ? (
                <LoaderCircle className="animate-spin" size={15} />
              ) : (
                <CheckCheck size={15} />
              )}
              <span>{markingAll ? "Updating…" : "Mark all read"}</span>
            </button>
          </div>
        </header>
        <div className="grid grid-cols-2 gap-3 sm:max-w-140 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
            <p className="text-xl font-extrabold tracking-tight text-teal-800">{notifications.length}</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">Updates</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
            <p className="text-xl font-extrabold tracking-tight text-teal-700">{unreadCount}</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">Unread</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
            <p className="text-xl font-extrabold tracking-tight text-slate-700">{pendingReminderCount}</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">Reminders</p>
          </div>
        </div>
        <p className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-xs text-slate-600">
          Reminder emails are sent to the Komsan account that created each
          reminder{accountEmail ? ` (${accountEmail})` : ""}. Switching accounts
          does not change where existing reminders are sent.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Filter notifications" className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {[
              { id: "all", label: "All activity", count: notifications.length + pendingReminderCount },
              { id: "unread", label: "Unread", count: unreadCount },
              { id: "reminders", label: "Reminders", count: pendingReminderCount },
            ].map((tab) => (
              <button
                aria-pressed={filter === tab.id}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold transition sm:px-3.5 ${
                  filter === tab.id
                    ? "bg-teal-800 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-teal-800"
                }`}
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                type="button"
              >
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[8px] ${filter === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
          <p className="text-[10px] font-medium text-slate-500">
            {unreadCount ? `${unreadCount} new update${unreadCount === 1 ? "" : "s"} to catch up on` : "You're all caught up"}
          </p>
        </div>

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
                void loadNotifications();
              }}
              type="button"
            >
              Retry
            </button>
          </div>
        )}

        {showReminderForm && (
          <form
            className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6"
            onSubmit={createReminder}
          >
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Create a reminder
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                It will appear in your reminder list when saved. We’ll email
                {accountEmail ? ` ${accountEmail}` : " the address on your Komsan account"}
                {" "}when it’s due, usually within a minute.
              </p>
            </div>
            {trips.length === 0 ? (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                A reminder must be linked to one of your trips.{" "}
                <a className="font-semibold underline" href="/trips/create">
                  Create a trip
                </a>{" "}
                first, then come back to add this reminder.
              </p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Trip
                    <select
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                      onChange={(event) =>
                        setNewReminder((current) => ({
                          ...current,
                          tripId: event.target.value,
                        }))
                      }
                      required
                      value={newReminder.tripId}
                    >
                      {trips.map((trip) => (
                        <option key={trip.id} value={trip.id}>
                          {trip.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Reminder type
                    <select
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 capitalize"
                      onChange={(event) =>
                        setNewReminder((current) => ({
                          ...current,
                          type: event.target.value,
                        }))
                      }
                      value={newReminder.type}
                    >
                      {[
                        "booking",
                        "payment",
                        "document",
                        "activity",
                        "packing",
                        "flight",
                        "custom",
                      ].map((type) => (
                        <option className="capitalize" key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-sm font-medium text-slate-700">
                  Title
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                    maxLength={255}
                    onChange={(event) =>
                      setNewReminder((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="e.g. Check in for your flight"
                    required
                    value={newReminder.title}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Due date and time
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                    onChange={(event) =>
                      setNewReminder((current) => ({
                        ...current,
                        dueDate: event.target.value,
                      }))
                    }
                    required
                    type="datetime-local"
                    value={newReminder.dueDate}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Notes (optional)
                  <textarea
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                    onChange={(event) =>
                      setNewReminder((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    rows={3}
                    value={newReminder.description}
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
                    onClick={() => setShowReminderForm(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    disabled={creatingReminder || trips.length === 0}
                    type="submit"
                  >
                    {creatingReminder ? "Saving…" : "Save reminder"}
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <section
          aria-label="Notification list"
          className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm lg:col-span-8"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent activity</h2>
              <p className="mt-0.5 text-[10px] text-slate-500">Updates from your trips and travel circle</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-600">
              {visibleItems.length} {visibleItems.length === 1 ? "item" : "items"}
            </span>
          </div>
          {loading ? (
            <div
              className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"
              role="status"
            >
              <LoaderCircle className="animate-spin text-teal-700" size={18} />
              Loading notifications…
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                {filter === "unread" ? <Check size={23} /> : <Bell size={23} />}
              </div>
              <h2 className="mt-4 text-base font-bold text-slate-900">
                {filter === "unread"
                  ? "You’re all caught up"
                  : filter === "reminders"
                    ? "No reminders yet"
                    : "No notifications or reminders yet"}
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-500">
                {filter === "unread"
                  ? "There are no unread notifications."
                  : "Trip updates and reminders will appear here."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5 p-3 sm:p-4">
              {visibleItems.map((item) => {
                const isReminder = item.itemType === "reminder";
                const presentation = getNotificationPresentation(item, isReminder);
                const linkedReminder = isReminder
                  ? item
                  : reminders.find(
                      (reminder) =>
                        String(reminder.id) === String(item.reminder_id),
                    );
                const isRead = !isReminder && item.is_read;
                const title = isReminder ? item.title : item.title;
                const message = isReminder
                  ? item.description || `Reminder type: ${item.type}`
                  : item.message;
                const date = isReminder ? item.due_date : item.created_at;
                return (
                <li
                  className={`group relative flex gap-3 rounded-xl border px-3.5 py-4 transition sm:gap-4 sm:px-4 ${
                    isRead || (isReminder && item.status === "completed")
                      ? "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                      : "border-teal-100 bg-teal-50 hover:border-teal-200"
                  }`}
                  key={`${item.itemType}:${item.id}`}
                >
                  {!isRead && !isReminder && <span aria-hidden="true" className="absolute right-3 top-3 h-2 w-2 rounded-full bg-teal-700 ring-4 ring-teal-100" />}
                  <NotificationAvatar item={item} isReminder={isReminder} presentation={presentation} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[12px] font-bold text-slate-900">
                        {title}
                      </h3>
                      {!isReminder && !item.is_read && (
                        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-teal-800">
                          New
                        </span>
                      )}
                      {isReminder && (
                        <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide ${item.status === "completed" ? "bg-slate-100 text-slate-500" : "bg-teal-100 text-teal-800"}`}>
                          {item.status}
                        </span>
                      )}
                      {item.email_sent_at && (
                        <span
                          className="rounded-full bg-emerald-100 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-emerald-800"
                          title={`Gmail accepted this email at ${formatDate(item.email_sent_at)}. Check your inbox or spam folder if it is missing.`}
                        >
                          Gmail accepted
                        </span>
                      )}
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[8px] font-semibold text-slate-500">
                        {presentation.label}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-slate-600">
                      {message}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <time className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-400" dateTime={date}>
                        <Clock3 size={11} /> {isReminder ? "Due " : ""}{formatDate(date)}
                      </time>
                      {item.trip_name && <span className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-400"><MapPin size={11} />{item.trip_name}</span>}
                      {item.actor_name && <span className="text-[9px] font-semibold text-slate-500">{item.actor_name}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    {linkedReminder?.status === "pending" && (
                      <button
                        aria-label={`Complete reminder ${linkedReminder.title}`}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-teal-100 hover:text-teal-800 disabled:opacity-50"
                        disabled={busyId === `reminder:${linkedReminder.id}`}
                        onClick={() => void completeReminder(linkedReminder)}
                        title="Complete reminder"
                        type="button"
                      >
                        {busyId === `reminder:${linkedReminder.id}` ? (
                          <LoaderCircle className="animate-spin" size={17} />
                        ) : (
                          <CheckCheck size={17} />
                        )}
                      </button>
                    )}
                    {!isReminder && !item.is_read && (
                      <button
                        aria-label={`Mark ${item.title} as read`}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-teal-100 hover:text-teal-800 disabled:opacity-50"
                        disabled={busyId === item.id}
                        onClick={() => void markAsRead(item)}
                        title="Mark as read"
                        type="button"
                      >
                        {busyId === item.id ? (
                          <LoaderCircle className="animate-spin" size={17} />
                        ) : (
                          <Check size={17} />
                        )}
                      </button>
                    )}
                    {isReminder ? (
                      <button
                        aria-label={`Delete reminder ${item.title}`}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        disabled={busyId === `reminder:${item.id}`}
                        onClick={() => void deleteReminder(item)}
                        title="Delete reminder"
                        type="button"
                      >
                        {busyId === `reminder:${item.id}` ? (
                          <LoaderCircle className="animate-spin" size={17} />
                        ) : (
                          <Trash2 size={17} />
                        )}
                      </button>
                    ) : (
                      <button
                        aria-label={`Delete ${item.title}`}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        disabled={busyId === item.id}
                        onClick={() => void deleteNotification(item.id)}
                        title="Delete notification"
                        type="button"
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </section>
        <aside className="space-y-4 lg:col-span-4">
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Your travel circle</h2>
                <p className="mt-1 text-[10px] text-slate-500">People showing up in your updates</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-700"><Sparkles size={16} /></span>
            </div>
            {peopleInUpdates.length ? (
              <div className="mt-4 space-y-3">
                {peopleInUpdates.map((person) => (
                  <div key={person.name} className="flex items-center gap-2.5">
                    {person.avatar ? (
                      <img alt="" src={person.avatar} className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-teal-50 text-[9px] font-bold text-teal-700">
                        {person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                      </span>
                    )}
                    <span className="flex-1 text-[11px] font-semibold text-slate-700">{person.name}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                <div className="flex -space-x-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-slate-50 bg-teal-50 text-teal-700"><UsersRound size={13} /></span>
                  <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-slate-50 bg-slate-100 text-slate-600"><UsersRound size={13} /></span>
                </div>
                <p className="text-[10px] leading-5 text-slate-500">When a companion shares a trip update, they’ll appear here.</p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Coming up</h2>
                <p className="mt-1 text-[10px] text-slate-500">Your next trip reminders</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-700"><CalendarDays size={16} /></span>
            </div>
            {upcomingReminders.length ? (
              <div className="space-y-2">
                {upcomingReminders.map((reminder) => (
                  <div key={reminder.id} className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700"><Clock3 size={13} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-bold leading-4 text-slate-700">{reminder.title}</span>
                      <time className="mt-1 block text-[9px] text-slate-500" dateTime={reminder.due_date}>{formatDate(reminder.due_date)}</time>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-3 py-4 text-[10px] leading-5 text-slate-500">Nothing scheduled yet. Add a reminder to keep your next plans on track.</p>
            )}
            <button
              type="button"
              onClick={() => setShowReminderForm((current) => !current)}
              disabled={trips.length === 0}
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-[10px] font-bold text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={13} /> Add a reminder <ArrowRight size={12} />
            </button>
          </section>

          <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-teal-700"><Bell size={15} /></span>
              <p className="text-[10px] leading-5 text-teal-900">Trip changes, shared moments, and reminders from your backend appear here as they happen.</p>
            </div>
          </div>
        </aside>
        </div>
      </div>
    </main>
  );
}

export default Notification;
