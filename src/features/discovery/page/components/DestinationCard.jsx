import { ArrowRight, Bookmark, Plus, Star } from 'lucide-react';

export const IconSearch = () => (
  <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

export const IconCalendar = () => (
  <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export const IconUsers = () => (
  <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

export const IconArrowRight = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

export const IconSparkles = () => (
  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

export const IconHeart = ({ active }) => (
  <svg className="h-4 w-4" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

export const IconChevronRight = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
  </svg>
);

function SaveButton({ item, isSaved, isSaving, onToggleSave }) {
  if (!onToggleSave) return null;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggleSave(item);
      }}
      disabled={isSaving}
      aria-label={isSaved ? 'Remove saved item' : 'Save item'}
      title={isSaved ? 'Remove saved item' : 'Save item'}
      className={`absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full shadow-md backdrop-blur-md transition disabled:cursor-wait disabled:opacity-50 ${
        isSaved
          ? 'bg-teal-800 text-white hover:bg-teal-900'
          : 'bg-white/90 text-slate-700 hover:bg-white hover:text-teal-800'
      }`}
    >
      <Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'} />
    </button>
  );
}

function formatUsd(value) {
  if (value === null || value === undefined || value === '') {
    return 'Cost not listed';
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

function CostBadge({ children }) {
  return (
    <div className="absolute left-4 top-4 z-10 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm backdrop-blur-sm">
      {children}
    </div>
  );
}

function getCardPrice(item) {
  if (item.average_daily_cost_usd != null) {
    return `${formatUsd(item.average_daily_cost_usd)} / day`;
  }
  if (item.estimated_daily_cost_usd != null) {
    const amount = typeof item.estimated_daily_cost_usd === 'object'
      ? `${formatUsd(item.estimated_daily_cost_usd.min)}–${formatUsd(item.estimated_daily_cost_usd.max)}`
      : formatUsd(item.estimated_daily_cost_usd);
    const estimatePrefix = item.daily_cost_is_estimate ? '~' : '';
    return `${estimatePrefix}${amount} / day`;
  }
  return 'Daily cost unavailable';
}

function getCurrencyFact(currency) {
  if (!currency) return 'Not listed';
  if (!/^[A-Za-z]{3}$/.test(currency)) return currency;
  try {
    const symbol = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value;
    return symbol ? `${currency.toUpperCase()} (${symbol})` : currency.toUpperCase();
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return currency.toUpperCase();
  }
}

function Fact({ label, value }) {
  return (
    <div className="min-w-0 px-2.5 py-2 first:pl-0 last:pr-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-[11px] font-semibold text-slate-700" title={value || 'Not listed'}>
        {value || 'Not listed'}
      </p>
    </div>
  );
}

export default function DestinationCard({
  item,
  isSaved = false,
  onToggleSave,
  isSaving = false,
  onAddToTrips,
  onClick,
}) {
  if (!item) return null;
  const title = item.title || item.name || 'Travel destination';
  const description =
    item.desc || item.description || 'Explore this destination and plan your next trip.';
  const bestTime = item.best_time || item.best_time_to_visit;
  const language = item.language;
  const showRating = item.rating !== null && item.rating !== undefined && item.rating !== '';
  const category = item.kind === 'destination'
    ? item.region || item.country || item.type || 'Destination'
    : item.category || item.type || item.source || 'Travel place';

  return (
    <div
      role={onClick ? 'link' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `View details for ${title}` : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      className={`group overflow-hidden rounded-3xl border border-slate-100 bg-white p-3.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-4 ${
        onClick ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600' : ''
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-linear-to-br from-teal-900 via-teal-800 to-slate-900 text-white">
        {item.img && (
          <img
            src={item.img}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-slate-950/85 via-slate-900/15 to-transparent" />
        <CostBadge>{getCardPrice(item)}</CostBadge>
        {typeof onToggleSave === 'function' && (
          <SaveButton
            item={item}
            isSaved={isSaved}
            isSaving={isSaving}
            onToggleSave={onToggleSave}
          />
        )}
        <div className="absolute inset-x-4 bottom-4 z-10 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-teal-100">
              {category}
            </p>
            {item.location && (
              <p className="mt-1 truncate text-[10px] font-medium text-white/80">
                {item.location}
              </p>
            )}
            <h3 className="mt-1 text-lg font-extrabold leading-tight text-white sm:text-xl">
              {title}
            </h3>
          </div>
          {showRating && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-950/65 px-2.5 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
              <Star size={12} className="fill-amber-400 text-amber-400" />
              {item.rating}
            </span>
          )}
        </div>
      </div>

      <div className="pt-3">
        <p className="line-clamp-2 min-h-10 text-xs leading-5 text-slate-600">
          {description}
        </p>
        <div className="mt-3 grid grid-cols-3 divide-x divide-slate-200 rounded-xl bg-slate-50 px-2">
          <Fact label="Best time" value={bestTime} />
          <Fact label="Currency" value={getCurrencyFact(item.currency)} />
          <Fact label="Language" value={language} />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClick?.();
            }}
            disabled={!onClick}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-800 transition hover:bg-indigo-100 disabled:cursor-default"
          >
            View Details <ArrowRight size={15} />
          </button>
          <button
            type="button"
            aria-label={`Add ${title} to My Trips`}
            title="Add to My Trips"
            onClick={(event) => {
              event.stopPropagation();
              onAddToTrips?.();
            }}
            disabled={!onAddToTrips}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-800 text-white transition hover:bg-teal-900 disabled:cursor-default disabled:opacity-60"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlaceCard({
  place,
  onClick,
  onAddToTrips,
  isSaved = false,
  onToggleSave,
  isSaving = false,
}) {
  if (!place) return null;

  return (
    <DestinationCard
      item={{ ...place, kind: place.kind || 'place' }}
      onClick={onClick}
      onAddToTrips={onAddToTrips}
      isSaved={isSaved}
      onToggleSave={onToggleSave}
      isSaving={isSaving}
    />
  );
}
