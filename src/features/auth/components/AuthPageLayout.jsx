export default function AuthPageLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
}) {
  return (
    <section className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/5 ring-1 ring-slate-200 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <aside className="relative hidden min-h-[640px] flex-col justify-between overflow-hidden bg-gradient-to-br from-teal-950 via-teal-800 to-emerald-700 p-10 text-white md:flex lg:p-14">
          <div
            aria-hidden="true"
            className="absolute -right-28 -top-24 h-80 w-80 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-36 -left-28 h-96 w-96 rounded-full border border-white/10"
          />
          <div className="relative">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-100">
              Komsan travel
            </p>
            <h2 className="mt-16 max-w-md text-4xl font-black leading-tight tracking-tight lg:text-5xl">
              Make room for your next great journey.
            </h2>
            <p className="mt-5 max-w-sm text-base leading-7 text-teal-50/90">
              Keep your favorite places, trip plans, and travel memories
              together in one workspace.
            </p>
          </div>
          <div className="relative rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100">
              Your travel workspace
            </p>
            <p className="mt-2 text-lg font-semibold">
              Find a place. Plan a trip. Go make memories.
            </p>
          </div>
        </aside>

        <div className="px-5 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-14">
          <div className="mx-auto w-full max-w-md">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {description}
            </p>
            {children}
            {footer}
          </div>
        </div>
      </div>
    </section>
  );
}
