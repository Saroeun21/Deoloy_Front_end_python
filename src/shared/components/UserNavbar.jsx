import { useEffect, useRef, useState } from "react";
import Logo from "../../assets/Logo/logo.png";
import DarkModeLogo from "../../assets/Logo/logodarkmode.png";
import {
  Bookmark,
  Bell,
  CalendarDays,
  ChevronDown,
  Compass,
  Globe,
  Images,
  LogIn,
  LogOut,
  MoreHorizontal,
  Moon,
  Plane,
  Sun,
  UserRound,
  Wallet,
} from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import notificationApi from "../../services/api/notificationapi.js";
import reminderApi from "../../services/api/reminderapi.js";
import { resolveApiUrl } from "../../services/api/httpClient.js";

const SEEN_DUE_REMINDERS_KEY = "tripos:seen-due-reminders";
const DARK_MODE_KEY = "tripos:dark-mode";

function getReminderKey(reminder) {
  return `${reminder.id}:${new Date(reminder.due_date).getTime()}`;
}

function UserNavbar({ onSignOut, isSignedIn, currentUser }) {
  const location = useLocation();
  const [hasNotificationUpdate, setHasNotificationUpdate] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [failedAccountAvatarUrl, setFailedAccountAvatarUrl] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem(DARK_MODE_KEY) === "true",
  );
  const seenDueReminderKeys = useRef(new Set());
  const acknowledgingNotifications = useRef(false);
  const accountInitial = currentUser?.name?.trim()?.charAt(0)?.toUpperCase();
  const accountAvatarUrl = currentUser?.avatar_url
    ? resolveApiUrl(currentUser.avatar_url)
    : "";
  const menuItems = [
    { name: "Home", icon: Compass, path: "/" },
    { name: "Explore", icon: Globe, path: "/explore" },
    { name: "Saved Places", icon: Bookmark, path: "/saved" },
    { name: "My Trips", icon: Plane, path: "/trips" },
    { name: "Itinerary", icon: CalendarDays, path: "/itinerary" },
    { name: "Budget & Wallet", icon: Wallet, path: "/budget" },
    { name: "Notifications", icon: Bell, path: "/notifications" },
    { name: "Memories", icon: Images, path: "/memories" },
  ];
  const mobilePrimaryItems = menuItems.slice(0, 4);
  const mobileMoreItems = menuItems.slice(4);
  const isMobileMoreActive = mobileMoreItems.some(
    (item) =>
      location.pathname === item.path ||
      location.pathname.startsWith(`${item.path}/`),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    localStorage.setItem(DARK_MODE_KEY, String(isDarkMode));
  }, [isDarkMode]);

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
    <>
    <header className="z-50 flex h-16 w-full shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 shadow-sm sm:h-20 sm:gap-4 sm:px-6 lg:px-8">
      <Link
        aria-label="Komsan homepage"
        className="navbar-logo-link flex shrink-0 items-center max-sm:w-28"
        to="/"
      >
        <img
          src={isDarkMode ? DarkModeLogo : Logo}
          alt="Komsan"
          className="h-10 w-28 object-contain sm:h-12 sm:w-36 xl:h-16 xl:w-48"
        />
      </Link>

      <nav
        aria-label="Main navigation"
        className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain sm:flex"
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
                `flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors max-sm:px-3 max-sm:text-xs ${
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
                  <span className="hidden max-sm:inline xl:inline">{item.name}</span>
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

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <button
          aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={isDarkMode}
          className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-teal-50 hover:text-teal-800"
          onClick={() => setIsDarkMode((current) => !current)}
          title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          type="button"
        >
          {isDarkMode ? (
            <Sun aria-hidden="true" size={18} />
          ) : (
            <Moon aria-hidden="true" size={18} />
          )}
        </button>
        {isSignedIn ? (
          <div className="relative">
            <button
              aria-expanded={isAccountMenuOpen}
              aria-haspopup="menu"
              aria-label="Account profile menu"
              className="flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white p-1 pr-2 text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50 sm:h-14 sm:gap-2.5 sm:p-1.5 sm:pr-3"
              onClick={() => setIsAccountMenuOpen((open) => !open)}
              type="button"
            >
              {accountAvatarUrl &&
              failedAccountAvatarUrl !== accountAvatarUrl ? (
                <img
                  alt=""
                  className="h-9 w-9 rounded-full object-cover sm:h-12 sm:w-12"
                  onError={() => setFailedAccountAvatarUrl(accountAvatarUrl)}
                  referrerPolicy="no-referrer"
                  src={accountAvatarUrl}
                />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-700 text-sm font-bold text-white sm:h-12 sm:w-12 sm:text-base">
                  {accountInitial || <UserRound aria-hidden="true" size={21} />}
                </span>
              )}
              <ChevronDown aria-hidden="true" size={17} />
            </button>
            {isAccountMenuOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
                role="menu"
              >
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {currentUser?.name || "Your account"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {currentUser?.email || ""}
                  </p>
                </div>
                <Link
                  className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-800"
                  onClick={() => setIsAccountMenuOpen(false)}
                  role="menuitem"
                  to="/profile"
                >
                  <UserRound aria-hidden="true" size={16} />
                  Profile
                </Link>
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    onSignOut();
                  }}
                  role="menuitem"
                  type="button"
                >
                  <LogOut aria-hidden="true" size={16} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
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
              className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-teal-800 sm:px-4 sm:text-sm sm:hover:scale-[1.03]"
              to="/register"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pt-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden"
    >
      {mobilePrimaryItems.map((item) => {
        const IconComponent = item.icon;
        const label =
          item.name === "Saved Places"
            ? "Saved"
            : item.name === "My Trips"
              ? "Trips"
              : item.name;
        return (
          <NavLink
            key={item.name}
            aria-label={item.name}
            onClick={() => setIsMobileMoreOpen(false)}
            className={({ isActive }) =>
              `flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium leading-none ${
                isActive ? "text-teal-800" : "text-slate-500"
              }`
            }
            end={item.path === "/"}
            to={item.path}
          >
            {({ isActive }) => (
              <>
                <IconComponent
                  aria-hidden="true"
                  size={20}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                <span className="max-w-full truncate">{label}</span>
              </>
            )}
          </NavLink>
        );
      })}
      <div className="relative flex min-w-0 justify-center">
        {isMobileMoreOpen && (
          <div
            aria-label="More navigation links"
            className="absolute right-1 bottom-[calc(100%+0.5rem)] z-[60] max-h-[min(70dvh,32rem)] w-60 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
          >
            {mobileMoreItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <NavLink
                  key={item.name}
                  className={({ isActive }) =>
                    `flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium ${
                      isActive
                        ? "bg-teal-50 text-teal-900"
                        : "text-slate-700 hover:bg-slate-50"
                    }`
                  }
                  onClick={() => {
                    setIsMobileMoreOpen(false);
                    if (item.path === "/notifications") {
                      void acknowledgeNotifications();
                    }
                  }}
                  to={item.path}
                >
                  <IconComponent aria-hidden="true" size={18} />
                  {item.name}
                </NavLink>
              );
            })}
          </div>
        )}
        <button
          aria-expanded={isMobileMoreOpen}
          aria-haspopup="true"
          className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium leading-none ${
            isMobileMoreOpen || isMobileMoreActive
              ? "text-teal-800"
              : "text-slate-500"
          }`}
          onClick={() => setIsMobileMoreOpen((open) => !open)}
          type="button"
        >
          <MoreHorizontal aria-hidden="true" size={20} />
          <span>More</span>
        </button>
      </div>
    </nav>
    </>
  );
}

export default UserNavbar;
