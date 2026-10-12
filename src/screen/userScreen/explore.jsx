import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DestinationCard from '../../features/discovery/page/components/DestinationCard';
import { getHomeDestinations } from '../../services/api/homeApi';
import { fetchPlaces } from '../../services/api/placeapi';
import { searchWikipediaPlaces } from '../../services/api/wikipediaPlaces';
import { getPlaceDetailPath } from '../../features/discovery/page/placeRoutes';
import { getSavedItemKey } from '../../features/discovery/page/components/savedItemKey';

const CATEGORIES = ['All', 'Destinations', 'Places'];
const EMPTY_SAVED_KEYS = [];

function Explore({
  savedItemKeys = EMPTY_SAVED_KEYS,
  onToggleSave = () => {},
  savingPlaceIds = [],
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const initialSearch = new URLSearchParams(location.search).get('search')?.trim() || '';
  const [query, setQuery] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const [destinations, setDestinations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [onlineResults, setOnlineResults] = useState(null);
  const [isSearchingOnline, setIsSearchingOnline] = useState(Boolean(initialSearch));
  const [isLoadingMoreOnline, setIsLoadingMoreOnline] = useState(false);
  const [onlineSearchError, setOnlineSearchError] = useState('');
  const [onlineContinuation, setOnlineContinuation] = useState(null);
  const [onlineCountryName, setOnlineCountryName] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const [destinationResult, placeResult] = await Promise.allSettled([
        getHomeDestinations(),
        fetchPlaces(),
      ]);

      if (!isMounted) {
        return;
      }

      const destinationDailyCosts = new Map(
        (destinationResult.status === 'fulfilled'
          ? destinationResult.value
          : []
        ).map((destination) => [
          String(destination.id),
          destination.average_daily_cost_usd,
        ]),
      );
      const destinationData =
        destinationResult.status === 'fulfilled'
          ? destinationResult.value.map((destination) => ({
              ...destination,
              kind: 'destination',
              title: destination.country
                ? `${destination.name}, ${destination.country}`
                : destination.name,
              desc: destination.description || '',
              img: destination.image || '',
              type: 'Destinations',
            }))
          : [];
      const destinationNames = new Map(
        (destinationResult.status === 'fulfilled'
          ? destinationResult.value
          : []
        ).map((destination) => [
          String(destination.id),
          [destination.name, destination.country].filter(Boolean).join(', '),
        ]),
      );
      const destinationCurrencies = new Map(
        (destinationResult.status === 'fulfilled'
          ? destinationResult.value
          : []
        ).map((destination) => [
          String(destination.id),
          destination.currency,
        ]),
      );
      const destinationDetails = new Map(
        (destinationResult.status === 'fulfilled'
          ? destinationResult.value
          : []
        ).map((destination) => [
          String(destination.id),
          {
            currency: destination.currency,
            language: destination.language,
            best_time: destination.best_time,
          },
        ]),
      );
      const placeData =
        placeResult.status === 'fulfilled'
          ? placeResult.value.map((place) => ({
              ...place,
              kind: 'place',
              estimated_daily_cost_usd: destinationDailyCosts.get(
                String(place.destination_id),
              ),
              currency: destinationCurrencies.get(
                String(place.destination_id),
              ),
              ...destinationDetails.get(String(place.destination_id)),
              title: place.name,
              desc: place.description || '',
              location:
                destinationNames.get(String(place.destination_id)) ||
                place.address ||
                '',
              img: place.image || '',
              tags: place.category ? [place.category] : [],
            }))
          : [];

      setDestinations([...destinationData, ...placeData]);
      setApiError(
        [destinationResult, placeResult]
          .filter((result) => result.status === 'rejected')
          .map((result) =>
            result.reason instanceof Error
              ? result.reason.message
              : 'An API request failed.',
          )
          .join(' '),
      );
      setIsLoading(false);
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  function retryLoad() {
    setIsLoading(true);
    setApiError('');
    setReloadKey((key) => key + 1);
  }

  async function completeOnlineSearch(searchTerm) {
    try {
      const result = await searchWikipediaPlaces(searchTerm);
      setOnlineResults(result.places);
      setOnlineContinuation(result.continuation);
      setOnlineCountryName(result.countryName);
    } catch (error) {
      setOnlineSearchError(
        error instanceof Error ? error.message : 'Online place search failed.',
      );
    } finally {
      setIsSearchingOnline(false);
    }
  }

  useEffect(() => {
    if (!initialSearch) return;
    void Promise.resolve().then(() => completeOnlineSearch(initialSearch));
  }, [initialSearch]);

  async function handleOnlineSearch(event) {
    event.preventDefault();
    const searchTerm = query.trim();
    if (!searchTerm) return;

    setIsSearchingOnline(true);
    setOnlineSearchError('');
    setOnlineResults(null);
    setOnlineContinuation(null);
    setOnlineCountryName(null);
    await completeOnlineSearch(searchTerm);
  }

  async function handleLoadMoreOnline() {
    if (!onlineContinuation || isLoadingMoreOnline) return;

    setIsLoadingMoreOnline(true);
    setOnlineSearchError('');
    try {
      const result = await searchWikipediaPlaces(
        query.trim(),
        undefined,
        onlineContinuation,
      );
      setOnlineResults((currentResults) => {
        const existingIds = new Set(currentResults.map((place) => place.id));
        return [
          ...currentResults,
          ...result.places.filter((place) => !existingIds.has(place.id)),
        ];
      });
      setOnlineContinuation(result.continuation);
      if (result.countryName) {
        setOnlineCountryName(result.countryName);
      }
    } catch (error) {
      setOnlineSearchError(
        error instanceof Error ? error.message : 'Could not load more places.',
      );
    } finally {
      setIsLoadingMoreOnline(false);
    }
  }

  const filteredPlaces = useMemo(() => {
    return destinations.filter((place) => {
      const title = place.title || place.name || '';
      const desc = place.desc || place.description || '';
      const tags = Array.isArray(place.tags) ? place.tags : [];
      const tagString = tags.join(' ');

      const matchesQuery = `${title} ${desc} ${tagString}`
        .toLowerCase()
        .includes(query.trim().toLowerCase());

      const matchesCategory =
        selectedCategory === 'All' ||
        (selectedCategory === 'Destinations' &&
          place.kind === 'destination') ||
        (selectedCategory === 'Places' && place.kind === 'place');

      return matchesQuery && matchesCategory;
    });
  }, [query, selectedCategory, destinations]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 text-slate-800 sm:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Banner Header */}
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 p-8 text-white shadow-xl sm:p-12">
          <div className="relative z-10 max-w-2xl space-y-3">
            <span className="inline-block rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-teal-300 backdrop-blur-md">
              TripOS Discovery
            </span>
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
              Explore Destinations & Places
            </h1>
            <p className="text-sm text-teal-100/80 sm:text-base">
              Browse destinations and places from the API, or search online for more ideas.
            </p>
          </div>
          <div className="absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
        </header>

        {/* Search & Categories Bar */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <form
              onSubmit={handleOnlineSearch}
              className="flex w-full max-w-3xl flex-col gap-2 sm:flex-row"
            >
              <div className="relative flex-1">
                <input
                  aria-label="Search places"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm shadow-sm transition placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOnlineResults(null);
                    setOnlineContinuation(null);
                    setOnlineCountryName(null);
                    setOnlineSearchError('');
                  }}
                  placeholder="Search a place or country..."
                />
                <svg
                  className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <button
                type="submit"
                disabled={!query.trim() || isSearchingOnline}
                className="rounded-2xl bg-teal-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSearchingOnline ? 'Searching…' : 'Search online places'}
              </button>
            </form>

            <div className="text-xs font-semibold text-slate-500">
              Showing{' '}
              <span className="text-teal-700">
                {onlineResults ? onlineResults.length : filteredPlaces.length}
              </span>{' '}
              {onlineResults ? 'Online places' : 'API results'}
            </div>
          </div>

          {apiError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              <p>{apiError}</p>
              <button
                className="font-semibold underline"
                onClick={retryLoad}
                type="button"
              >
                Retry
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  selectedCategory === category
                    ? 'bg-teal-700 text-white shadow-md shadow-teal-700/20'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {onlineSearchError && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            {onlineSearchError}
          </div>
        )}

        {isSearchingOnline && (
          <div
            role="status"
            className="rounded-2xl border border-teal-100 bg-white px-5 py-4 shadow-sm"
          >
            <p className="text-sm font-bold text-slate-800">
              Searching for {query.trim()} destinations…
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Finding real places, photos, and travel details.
            </p>
          </div>
        )}

        {onlineResults && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {onlineCountryName
                    ? `Popular places in ${onlineCountryName}`
                    : `Online place results for “${query.trim()}”`}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Daily budgets are approximate planning estimates, not live prices.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOnlineResults(null);
                  setOnlineContinuation(null);
                  setOnlineCountryName(null);
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Back to destinations
              </button>
            </div>

            {onlineResults.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Showing {onlineResults.length} places
                    {query.trim() ? ` for “${query.trim()}”` : ''}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Typical daily budget</span>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-bold text-slate-700">
                      USD Base
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {onlineResults.map((place) => (
                    <DestinationCard
                      key={place.id}
                      item={place}
                      isSaved={savedItemKeys.includes(getSavedItemKey(place))}
                      onToggleSave={onToggleSave}
                      isSaving={savingPlaceIds.includes(getSavedItemKey(place))}
                      onAddToTrips={() =>
                        navigate('/trips', { state: { addDestination: place } })
                      }
                      onClick={() =>
                        navigate(getPlaceDetailPath(place), {
                          state: { destination: place },
                        })
                      }
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
                No online places matched that search. Try a city or landmark name.
              </div>
            )}

            {onlineContinuation && (
              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={isLoadingMoreOnline}
                  onClick={handleLoadMoreOnline}
                  className="rounded-xl border border-teal-200 bg-white px-6 py-3 text-sm font-bold text-teal-700 shadow-sm transition hover:bg-teal-50 disabled:cursor-wait disabled:opacity-60"
                >
                  {isLoadingMoreOnline ? 'Loading more places…' : 'Load more search results'}
                </button>
              </div>
            )}
          </section>
        )}

        {/* Grid Content */}
        {onlineResults === null && isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="h-80 animate-pulse rounded-3xl bg-slate-200/60"
              />
            ))}
          </div>
        ) : onlineResults === null && isSearchingOnline ? null : onlineResults === null && filteredPlaces.length > 0 ? (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Showing {filteredPlaces.length} destinations &amp; places
                {query.trim() ? ` matching “${query.trim()}”` : ''}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Typical daily budget</span>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-bold text-slate-700">
                  USD Base
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPlaces.map((place) => (
                <div
                  key={`${place.kind}-${place.id}`}
                  className="transition-transform hover:-translate-y-1"
                >
                  <DestinationCard
                    item={place}
                    isSaved={savedItemKeys.includes(getSavedItemKey(place))}
                    onToggleSave={onToggleSave}
                    isSaving={savingPlaceIds.includes(getSavedItemKey(place))}
                    onAddToTrips={() =>
                      navigate('/trips', { state: { addDestination: place } })
                    }
                    onClick={() =>
                      navigate(getPlaceDetailPath(place), {
                        state: { destination: place },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </>
        ) : onlineResults === null && !isLoading && !apiError ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <p className="text-base font-semibold text-slate-700">
              No API results match “{query}”
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Try adjusting your search terms or clearing selected category filters.
            </p>
            <button
              onClick={() => {
                setQuery('');
                setSelectedCategory('All');
              }}
              className="mt-4 rounded-xl bg-teal-50 px-4 py-2 text-xs font-bold text-teal-700 hover:bg-teal-100"
            >
              Reset Filters
            </button>
          </div>
        ) : null}

      </div>

    </div>
  );
}

export default Explore;