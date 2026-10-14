import { useEffect, useRef, useState } from "react";
import Logo from "../../assets/Logo/logo.png";
import {
  Bookmark,
  Bell,
  Compass,
  Globe,
  Images,
  LogIn,
  LogOut,
  Plane,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import notificationApi from "../../services/api/notificationapi.js";
import reminderApi from "../../services/api/reminderapi.js";

const SEEN_DUE_REMINDERS_KEY = "tripos:seen-due-reminders";

function getReminderKey(reminder) {
  return `${reminder.id}:${new Date(reminder.due_date).getTime()}`;
}

function UserNavbar({ onSignOut, isSignedIn }) {
  const [hasNotificationUpdate, setHasNotificationUpdate] = useState(false);
  const seenDueReminderKeys = useRef(new Set());
  const acknowledgingNotifications = useRef(false);
  const menuItems = [
    { name: "Home", icon: Compass, path: "/" },
    { name: "Explore", icon: Globe, path: "/explore" },
    { name: "Saved Places", icon: Bookmark, path: "/saved" },
    { name: "My Trips", icon: Plane, path: "/trips" },
    { name: "Budget & Wallet", icon: Wallet, path: "/budget" },
    { name: "AI Assistant", icon: Sparkles, path: "/ai", badge: "PRO" },
    { name: "Notifications", icon: Bell, path: "/notifications" },
    { name: "Memories", icon: Images, path: "/memories" },
  ];

  useEffect(() => {
    if (!isSignedIn) {
      seenDueReminderKeys.current.clear();
      return undefined;
    }

    let active = true;
    let checking = false;
    try {
      const savedKeys = JSON.parse(
        localStorage.getItem(SEEN_DUE_REMINDERS_KEY) || "[]",
      );
      if (!Array.isArray(savedKeys)) {
        throw new Error("Saved reminder acknowledgements are invalid.");
      }
      seenDueReminderKeys.current.clear();
      for (const key of savedKeys) {
        if (typeof key === "string") seenDueReminderKeys.current.add(key);
      }
    } catch (error) {
      console.error("Could not load seen reminder acknowledgements:", error);
    }
    const checkNotifications = async () => {
      if (checking) return;
      checking = true;
      try {
        const [notifications, reminders] = await Promise.all([
          notificationApi.list(),
          reminderApi.list(),
        ]);
        if (!Array.isArray(notifications) || !Array.isArray(reminders)) {
          throw new Error("The notifications API returned an invalid list.");
        }

        const now = Date.now();
        const hasUnreadNotifications = notifications.some(
          (notification) => !notification.is_read,
        );
        const hasDueReminders = reminders.some(
          (reminder) =>
            reminder.status === "pending" &&
            Number.isFinite(new Date(reminder.due_date).getTime()) &&
            new Date(reminder.due_date).getTime() <= now &&
            !seenDueReminderKeys.current.has(getReminderKey(reminder)),
        );
        if (active) {
          setHasNotificationUpdate(hasUnreadNotifications || hasDueReminders);
        }
      } catch (error) {
        console.error("Could not check for notification updates:", error);
      } finally {
        checking = false;
      }
    };

    void checkNotifications();
    const intervalId = window.setInterval(
      () => void checkNotifications(),
      30_000,
    );
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkNotifications();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isSignedIn]);

  async function acknowledgeNotifications() {
    if (!isSignedIn || acknowledgingNotifications.current) return;
    acknowledgingNotifications.current = true;
    try {
      const [notifications, reminders] = await Promise.all([
        notificationApi.list(),
        reminderApi.list(),
      ]);
      if (!Array.isArray(notifications) || !Array.isArray(reminders)) {
        throw new Error("The notifications API returned an invalid list.");
      }

      const unreadNotifications = notifications.filter(
        (notification) => !notification.is_read,
      );
      const updates = await Promise.allSettled(
        unreadNotifications.map((notification) =>
          notificationApi.markAsRead(notification.id),
        ),
      );
      const failedUpdates = updates.filter(
        (result) => result.status === "rejected",
      );
      for (const result of failedUpdates) {
        console.error("Could not mark notification as read:", result.reason);
      }

      const now = Date.now();
      for (const reminder of reminders) {
        if (
          reminder.status === "pending" &&
          Number.isFinite(new Date(reminder.due_date).getTime()) &&
          new Date(reminder.due_date).getTime() <= now
        ) {
          seenDueReminderKeys.current.add(getReminderKey(reminder));
        }
      }
      try {
        localStorage.setItem(
          SEEN_DUE_REMINDERS_KEY,
          JSON.stringify([...seenDueReminderKeys.current]),
        );
      } catch (error) {
        console.error("Could not save seen reminder acknowledgements:", error);
      }
      setHasNotificationUpdate(failedUpdates.length > 0);
    } catch (error) {
      console.error("Could not acknowledge notifications:", error);
    } finally {
      acknowledgingNotifications.current = false;
    }
  }

  return (
    <header className="z-50 flex h-20 w-full shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
      <Link
        aria-label="Komsan homepage"
        className="flex shrink-0 items-center"
        to="/"
      >
        <img
          src={Logo}
          alt="Komsan"
          className="h-16 w-48 object-contain"
        />
      </Link>

      <nav
        aria-label="Main navigation"
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
      >
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isIndigo = item.badge === "PRO";

          return (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === "/"}
              aria-label={
                item.path === "/notifications" && hasNotificationUpdate
                  ? "Notifications (updates)"
                  : item.name
              }
              title={
                item.path === "/notifications" && hasNotificationUpdate
                  ? "Notifications (updates)"
                  : item.name
              }
              onClick={() => {
                if (item.path === "/notifications") {
                  void acknowledgeNotifications();
                }
              }}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? isIndigo
                      ? "bg-indigo-600 text-white"
                      : "bg-teal-700 text-white"
                    : isIndigo
                      ? "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                      : "text-slate-600 hover:bg-teal-50 hover:text-teal-800"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative shrink-0">
                    <IconComponent
                      aria-hidden="true"
                      size={17}
                      strokeWidth={isActive ? 2.3 : 2}
                    />
                    {item.path === "/notifications" &&
                      isSignedIn &&
                      hasNotificationUpdate && (
                        <span
                          aria-hidden="true"
                          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white"
                        />
                      )}
                  </span>
                  <span>{item.name}</span>
                  {item.badge && (
                    <span
                      className={`rounded px-1 py-0.5 text-[9px] font-bold leading-none ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {isSignedIn ? (
        <button
          aria-label="Sign out"
          className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
          onClick={onSignOut}
          type="button"
        >
          <LogOut aria-hidden="true" size={17} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <NavLink
            aria-label="Sign in"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-teal-700 text-white"
                  : "text-slate-600 hover:bg-teal-50 hover:text-teal-800"
              }`
            }
            title="Sign in"
            to="/login"
          >
            <LogIn aria-hidden="true" size={17} />
            <span className="hidden sm:inline">Sign in</span>
          </NavLink>
          <Link
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white transition hover:scale-[1.03] hover:bg-teal-800"
            to="/register"
          >
            Sign up
          </Link>
        </div>
      )}
    </header>
  );
}

export default UserNavbar;
