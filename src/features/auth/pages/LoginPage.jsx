import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/authContext.js";
import { useEffect, useRef, useState } from "react";
import GoogleSignInButton from "../components/GoogleSignInButton.jsx";
import AuthPageLayout from "../components/AuthPageLayout.jsx";

export default function LoginPage() {
  const {
    googleRedirectComplete,
    googleRedirectError,
    signIn,
    signInWithGoogle,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const errorMessageRef = useRef(null);

  useEffect(() => {
    if (googleRedirectComplete) {
      navigate("/", { replace: true });
    }
  }, [googleRedirectComplete, navigate]);

  useEffect(() => {
    if (error || googleRedirectError) {
      errorMessageRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [error, googleRedirectError]);

  async function handleGoogleSignIn() {
    setSubmitting(true);
    setError("");
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn) {
        const returnTo = location.state?.from;
        navigate(returnTo || "/", { replace: true });
      }
    } catch (googleError) {
      console.error("Could not sign in with Google:", googleError);
      setError(
        googleError instanceof Error
          ? googleError.message
          : "Could not sign in with Google. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await signIn({ email: email.trim(), password });
      const returnTo = location.state?.from;
      navigate(returnTo || "/", { replace: true });
    } catch (authError) {
      console.error("Could not sign in:", authError);
      setError(
        authError instanceof Error
          ? authError.message
          : "Could not sign in. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageLayout
      eyebrow="Komsan account"
      title="Sign in to Komsan"
      description="Save places, build trips, and manage your travel workspace. You can browse destinations without signing in."
      footer={
        <>
          <p className="mt-5 text-center text-sm text-slate-500">
            New to Komsan?{" "}
            <Link
              className="font-semibold text-teal-700 hover:text-teal-900"
              state={location.state}
              to="/register"
            >
              Create an account
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
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
            autoComplete="current-password"
            className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        <button
          className="w-full rounded-xl bg-teal-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {(error || googleRedirectError) && (
        <p
          ref={errorMessageRef}
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error || googleRedirectError}
        </p>
      )}

      <GoogleSignInButton
        disabled={submitting}
        onClick={() => void handleGoogleSignIn()}
        submitting={submitting}
      />
    </AuthPageLayout>
  );
}
