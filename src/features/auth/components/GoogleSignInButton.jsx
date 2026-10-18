export default function GoogleSignInButton({
  disabled,
  onClick,
  submitting,
}) {
  return (
    <button
      className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 48 48">
        <path
          d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.9 6-15Z"
          fill="#4285F4"
        />
        <path
          d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9v5.2A20 20 0 0 0 24 44Z"
          fill="#34A853"
        />
        <path
          d="M12.8 27.8a12 12 0 0 1 0-7.6V15H5.9a20 20 0 0 0 0 18Z"
          fill="#FBBC05"
        />
        <path
          d="M24 12c3 0 5.6 1 7.7 3l5.8-5.8A19 19 0 0 0 24 4 20 20 0 0 0 5.9 15l6.9 5.2C14.4 15.5 18.8 12 24 12Z"
          fill="#EA4335"
        />
      </svg>
      {submitting ? "Connecting to Google…" : "Continue with Google"}
    </button>
  );
}
