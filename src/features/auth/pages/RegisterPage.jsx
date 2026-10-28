import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/authContext.js";
import GoogleSignInButton from "../components/GoogleSignInButton.jsx";
import AuthPageLayout from "../components/AuthPageLayout.jsx";

export default function RegisterPage() {
  const {
    googleRedirectComplete,
    googleRedirectError,
    signInWithGoogle,
    signUp,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profile, setProfile] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (googleRedirectComplete) {
      navigate("/", { replace: true });
    }
  }, [googleRedirectComplete, navigate]);

  async function handleGoogleSignIn() {
    setError("");
    setSubmitting(true);
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn) {
        navigate(location.state?.from || "/", { replace: true });
      }
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
    <AuthPageLayout
      eyebrow="Komsan account"
      title="Create your account"
      description="Register to save places, plan trips, and use your travel workspace. You can browse destinations without signing in."
      footer={
        <>
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
        </>
      }
    >
      {(error || googleRedirectError) && (
        <p
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error || googleRedirectError}
        </p>
      )}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-700">
          Name
          <input
            autoComplete="name"
            className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
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
            className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
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
            className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
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
            className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Profile (optional)
          <input
            className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
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
    </AuthPageLayout>
  );
}
