import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/authContext.js";
import GoogleSignInButton from "../components/GoogleSignInButton.jsx";

export default function RegisterPage() {
  const { signInWithGoogle, signUp } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profile, setProfile] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleSignIn() {
    setError("");
    setSubmitting(true);
    try {
      await signInWithGoogle();
      navigate(location.state?.from || "/", { replace: true });
    } catch (googleError) {
      console.error("Could not register with Google:", googleError);
      setError(
        googleError instanceof Error
          ? googleError.message
          : "Could not create your account with Google. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await signUp({
        email: email.trim(),
        name: name.trim(),
        password,
        profile: profile.trim() || null,
      });
      navigate(location.state?.from || "/", { replace: true });
    } catch (registerError) {
      console.error("Could not register account:", registerError);
      setError(
        registerError instanceof Error
          ? registerError.message
          : "Could not create your account. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex min-h-full items-center justify-center bg-slate-50 p-5 sm:p-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
          Komsan account
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Register to save places, plan trips, and use your travel workspace.
          You can browse destinations without signing in.
        </p>

        {error && (
          <p
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Name
            <input
              autoComplete="name"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              required
              type="text"
              value={name}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              autoComplete="email"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <span className="mt-1 block text-xs text-slate-400">
              Use at least 8 characters.
            </span>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Confirm password
            <input
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Profile (optional)
            <input
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              maxLength={255}
              onChange={(event) => setProfile(event.target.value)}
              placeholder="A short bio or travel preference"
              type="text"
              value={profile}
            />
          </label>

          <button
            className="w-full rounded-xl bg-teal-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <GoogleSignInButton
          disabled={submitting}
          onClick={() => void handleGoogleSignIn()}
          submitting={submitting}
        />

        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            className="font-semibold text-teal-700 hover:text-teal-900"
            state={location.state}
            to="/login"
          >
            Sign in
          </Link>
        </p>
        <p className="mt-4 text-center text-sm">
          <Link className="font-medium text-slate-500 underline" to="/">
            Continue browsing destinations
          </Link>
        </p>
      </div>
    </section>
  );
}
