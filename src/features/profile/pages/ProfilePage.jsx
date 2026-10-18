import { useEffect, useMemo, useState } from "react";
import { UserRound } from "lucide-react";
import { resolveApiUrl } from "../../../services/api/httpClient.js";

export default function ProfilePage({
  user,
  loading,
  loadError,
  onUpdateProfile,
  onUpdateAvatar,
}) {
  const [name, setName] = useState(() => user?.name || "");
  const [profile, setProfile] = useState(() => user?.profile || "");
  const [avatarFile, setAvatarFile] = useState(null);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const avatarPreview = useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : ""),
    [avatarFile],
  );
  const avatarSource = avatarPreview || (
    user?.avatar_url ? resolveApiUrl(user.avatar_url) : ""
  );

  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSaved(false);

    try {
      if (avatarFile) {
        await onUpdateAvatar(avatarFile);
        setAvatarFile(null);
      }
      await onUpdateProfile({
        name: name.trim(),
        profile: profile.trim() || null,
      });
      setSaved(true);
    } catch (updateError) {
      console.error("Could not update account profile:", updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update your profile. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 lg:px-10">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200 sm:p-10 lg:p-12">
        <div className="flex items-center gap-4">
          {avatarSource && failedAvatarUrl !== avatarSource ? (
            <img
              alt="Your profile avatar"
              className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-teal-100"
              onError={() => setFailedAvatarUrl(avatarSource)}
              referrerPolicy="no-referrer"
              src={avatarSource}
            />
          ) : (
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-800">
              <UserRound aria-hidden="true" size={36} />
            </div>
          )}
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-700">
              Your account
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              {user?.name?.trim() || "Profile"}
            </h1>
          </div>
        </div>

        <p className="mt-6 text-base text-slate-500">
          Update the name and profile information shown in your Komsan account.
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500" role="status">
            Loading your profile…
          </p>
        ) : loadError ? (
          <p
            className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {loadError}
          </p>
        ) : (
          <form className="mt-8 space-y-8" onSubmit={handleSubmit}>
            {error && (
              <p
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}
            {saved && (
              <p
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                role="status"
              >
                Your profile has been updated.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-slate-200 p-6">
              {avatarSource && failedAvatarUrl !== avatarSource ? (
                <img
                  alt="Avatar preview"
                  className="h-24 w-24 rounded-full object-cover ring-2 ring-teal-100"
                  onError={() => setFailedAvatarUrl(avatarSource)}
                  referrerPolicy="no-referrer"
                  src={avatarSource}
                />
              ) : (
                <div className="grid h-24 w-24 place-items-center rounded-full bg-teal-100 text-teal-800">
                  <UserRound aria-hidden="true" size={40} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <label className="block text-sm font-semibold text-slate-700">
                  Profile photo
                  <input
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-teal-800 hover:file:bg-teal-100"
                    onChange={(event) => {
                      setAvatarFile(event.target.files?.[0] || null);
                      setError("");
                      setSaved(false);
                    }}
                    type="file"
                  />
                </label>
                <p className="mt-1 text-xs text-slate-400">
                  Select a PNG, JPG, GIF, or WebP image up to 5 MB. Save changes
                  to upload it.
                </p>
              </div>
            </div>

            <div className="space-y-5">
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
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-500"
                  readOnly
                  type="email"
                  value={user?.email || ""}
                />
                <span className="mt-1 block text-xs text-slate-400">
                  Email address cannot be changed here.
                </span>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                About you
                <textarea
                  className="mt-1.5 min-h-28 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  maxLength={255}
                  onChange={(event) => setProfile(event.target.value)}
                  placeholder="A short bio or travel preference"
                  value={profile}
                />
                <span className="mt-1 block text-xs text-slate-400">
                  Up to 255 characters.
                </span>
              </label>

              <button
                className="rounded-xl bg-teal-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting || !user}
                type="submit"
              >
                {submitting ? "Saving changes…" : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
