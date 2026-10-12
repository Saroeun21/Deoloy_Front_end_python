import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getHomeDestinations,
} from '../../services/api/homeApi';
import { fetchPlaces } from '../../services/api/placeapi';
import DestinationCard, { 
  PlaceCard, 
  IconSearch,
  IconCalendar,
  IconUsers,
  IconArrowRight,
  IconSparkles,
  IconChevronRight
} from '../../features/discovery/page/components/DestinationCard';
import { getPlaceDetailPath } from '../../features/discovery/page/placeRoutes';
import { getSavedItemKey } from '../../features/discovery/page/components/savedItemKey';

export default function Home({
  savedItemKeys = [],
  onToggleSave = () => {},
  savingPlaceIds = [],
}) {
  const navigate = useNavigate();
  const popularDestinationsRef = useRef(null);
  const popularDestinationsGroupRef = useRef(null);
  const popularDestinationsTrackRef = useRef(null);
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [destinations, setDestinations] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [destinationsLoading, setDestinationsLoading] = useState(true);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [destinationsError, setDestinationsError] = useState('');
  const [recommendationsError, setRecommendationsError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const [destinationResult, placesResult] = await Promise.allSettled([
        getHomeDestinations(100),
        fetchPlaces(100),
      ]);

      if (cancelled) {
        return;
      }

      if (destinationResult.status === 'fulfilled') {
        setDestinations(destinationResult.value.map((destination) => ({
          ...destination,
          kind: 'destination',
          title: destination.country
            ? `${destination.name}, ${destination.country}`
            : destination.name,
          desc: destination.description || '',
          img: destination.image || '',
          type: 'Destinations',
        })));
      } else {
        setDestinations([]);
        setDestinationsError(
          destinationResult.reason instanceof Error
            ? destinationResult.reason.message
            : 'Could not load destinations.',
        );
      }
      setDestinationsLoading(false);

      if (placesResult.status === 'fulfilled') {
        const destinationDailyCosts = new Map(
          destinationResult.status === 'fulfilled'
            ? destinationResult.value.map((destination) => [
                String(destination.id),
                destination.average_daily_cost_usd,
              ])
            : [],
        );
        const destinationNames = new Map(
          destinationResult.status === 'fulfilled'
            ? destinationResult.value.map((destination) => [
                String(destination.id),
                [destination.name, destination.country].filter(Boolean).join(', '),
              ])
            : [],
        );
        const destinationCurrencies = new Map(
          destinationResult.status === 'fulfilled'
            ? destinationResult.value.map((destination) => [
                String(destination.id),
                destination.currency,
              ])
            : [],
        );
        const destinationDetails = new Map(
          destinationResult.status === 'fulfilled'
            ? destinationResult.value.map((destination) => [
                String(destination.id),
                {
                  currency: destination.currency,
                  language: destination.language,
                  best_time: destination.best_time,
                },
              ])
            : [],
        );
        setRecommendations(placesResult.value.map((place) => ({
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
        })));
      } else {
        setRecommendations([]);
        setRecommendationsError(
          placesResult.reason instanceof Error
            ? placesResult.reason.message
            : 'Could not load recommended places.',
        );
      }
      setRecommendationsLoading(false);
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function retryLoad() {
    setDestinationsLoading(true);
    setRecommendationsLoading(true);
    setDestinationsError('');
    setRecommendationsError('');
    setReloadKey((key) => key + 1);
  }

  const openDestinationSearch = () => {
    const query = searchQuery.trim();
    navigate(query ? `/explore?search=${encodeURIComponent(query)}` : '/explore');
  };

  const filteredDestinations = destinations.filter(item => {
    const matchesSearch = item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.desc?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'All' || item.type?.toLowerCase() === activeTab.toLowerCase();
    return matchesSearch && matchesTab;
  });

  const seekPopularDestinations = (toEnd) => {
    const carousel = popularDestinationsRef.current;
    const group = popularDestinationsGroupRef.current;
    const animation = popularDestinationsTrackRef.current
      ?.getAnimations()
      .find((item) => item.playState !== 'finished');

    if (animation && group) {
      const duration = Number(animation.effect?.getTiming().duration);
      const endProgress = Math.max(
        0,
        (group.offsetWidth - carousel.clientWidth) /
          (group.offsetWidth * 2),
      );
      animation.currentTime = toEnd ? duration * endProgress : 0;
      return;
    }

    carousel?.scrollTo({
      left: toEnd ? carousel.scrollWidth : 0,
      behavior: 'smooth',
    });
  };

  return (
    <div className="p-6 md:p-8 space-y-8 pb-16 min-h-screen bg-slate-50 text-slate-800">
      
      {/* Hero Banner */}
      <section className="relative rounded-3xl bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 text-white p-6 md:p-10 overflow-hidden shadow-xl">
        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold border border-teal-500/30">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          TRIPOS TRAVEL WORKSPACE
          </div>
          
          
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Where will you <span className="bg-gradient-to-r from-teal-200 to-cyan-400 bg-clip-text text-transparent">go next?</span>
          </h1>
          
          <p className="text-slate-300 text-xs md:text-sm max-w-xl mx-auto">
            Discover places, plan your trip, manage your budget, and keep everything in one calm workspace.
          </p>

          {/* Search Box */}
          <div className="mt-6 bg-white rounded-2xl p-3 text-slate-800 shadow-2xl space-y-3 text-left">
            <div className="flex items-center gap-1 border-b border-slate-100 pb-2 overflow-x-auto text-xs font-semibold">
              {['All', 'Destinations'].map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                    activeTab === tab ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
              <div className="md:col-span-5 flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <IconSearch />
                <input 
                  type="text" 
                  aria-label="Search destinations"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      openDestinationSearch();
                    }
                  }}
                  placeholder="Search destinations... (e.g. China)" 
                  className="bg-transparent w-full text-xs outline-none font-medium text-slate-800"
                />
              </div>

              <div className="md:col-span-3 flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <IconCalendar />
                <div>
                  <div className="text-[9px] uppercase font-bold text-slate-400">DESTINATIONS</div>
                  <div className="text-xs font-semibold text-slate-700">
                    {destinationsLoading ? 'Loading…' : destinations.length}
                  </div>
                </div>
              </div>

              <div className="md:col-span-3 flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <IconUsers />
                <div>
                  <div className="text-[9px] uppercase font-bold text-slate-400">PLACES TO VISIT</div>
                  <div className="text-xs font-semibold text-slate-700">
                    {recommendationsLoading ? 'Loading…' : recommendations.length}
                  </div>
                </div>
              </div>

              <button 
                type="button"
                onClick={openDestinationSearch}
                aria-label="Search destinations"
                className="md:col-span-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl flex items-center justify-center p-3 transition"
              >
                <IconArrowRight />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 pt-2">
            <button 
              type="button"
              onClick={() => navigate('/explore')}
              className="bg-teal-500 hover:bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition flex items-center gap-2"
            >
              Explore Destinations <IconArrowRight />
            </button>
            <button 
              type="button"
              onClick={() => navigate('/trips')}
              className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl font-bold text-xs border border-white/20 transition"
            >
              Plan a Trip
            </button>
          </div>
        </div>
      </section>

      {/* Popular Destinations */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-teal-600 tracking-wider">01 // DESTINATIONS</div>
            <h2 className="text-xl font-black text-slate-800">Destinations</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label="Scroll to the first destination"
              onClick={() => seekPopularDestinations(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Start
            </button>
            <button
              type="button"
              aria-label="Scroll to the last destination"
              onClick={() => seekPopularDestinations(true)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              End
            </button>
            <button 
              type="button"
              onClick={() => navigate('/explore')}
              className="flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-800"
            >
              View all ({filteredDestinations.length}) <IconChevronRight />
            </button>
          </div>
        </div>

        <div
          ref={popularDestinationsRef}
          aria-label="Destinations"
          className="relative flex w-full min-w-0 overflow-x-auto pb-3 scrollbar-none [&::-webkit-scrollbar]:hidden"
        >
          <div ref={popularDestinationsTrackRef} className="popular-destinations-track">
            <div ref={popularDestinationsGroupRef} className="flex w-max shrink-0 gap-4 pr-4">
              {destinationsLoading ? (
                <p className="py-8 text-sm text-slate-500" role="status">
                  Loading destinations…
                </p>
              ) : destinationsError ? (
                <div className="py-6 text-sm text-red-700" role="alert">
                  <p>{destinationsError}</p>
                  <button
                    className="mt-2 font-semibold underline"
                    onClick={retryLoad}
                    type="button"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredDestinations.length > 0 ? filteredDestinations.map(item => (
                <div key={item.id} className="w-[min(85vw,19rem)] shrink-0">
                  <DestinationCard 
                    item={item}
                    isSaved={savedItemKeys.includes(getSavedItemKey(item))}
                    onToggleSave={onToggleSave}
                    isSaving={savingPlaceIds.includes(getSavedItemKey(item))}
                    onAddToTrips={() =>
                      navigate('/trips', { state: { addDestination: item } })
                    }
                      onClick={() =>
                        navigate(getPlaceDetailPath(item), {
                          state: { destination: item },
                        })
                      }
                  />
                </div>
              )) : (
                <p className="py-8 text-sm text-slate-500">
                  No destinations are available yet.
                </p>
              )}
            </div>
            <div
              aria-hidden="true"
              inert
              className="flex w-max shrink-0 gap-4 pr-4"
            >
              {!destinationsLoading && !destinationsError && filteredDestinations.map(item => (
                <div key={`duplicate-${item.id}`} className="w-[min(85vw,19rem)] shrink-0">
                  <DestinationCard
                    item={item}
                    isSaved={savedItemKeys.includes(getSavedItemKey(item))}
                    onToggleSave={onToggleSave}
                    isSaving={savingPlaceIds.includes(getSavedItemKey(item))}
                    onAddToTrips={() =>
                      navigate('/trips', { state: { addDestination: item } })
                    }
                    onClick={() =>
                      navigate(getPlaceDetailPath(item), {
                        state: { destination: item },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI Feature Banner */}
      <section className="bg-gradient-to-r from-teal-800 via-teal-700 to-slate-900 rounded-2xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg">
        <div className="space-y-2 max-w-xl">
          <span className="bg-teal-500/30 text-teal-200 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border border-teal-400/30">
            TripOS Screenshot AI 2.0
          </span>
          <h3 className="text-xl font-extrabold">Stop manually typing flight bookings and reservations.</h3>
          <p className="text-xs text-slate-300">
            Paste a screenshot of any booking confirmation or receipt to automatically sync times and costs.
          </p>
        </div>
        <button 
          type="button"
          onClick={() => navigate('/ai')}
          className="bg-white text-slate-900 hover:bg-slate-100 px-5 py-3 rounded-xl font-bold text-xs shadow-md transition flex items-center gap-2 whitespace-nowrap"
        >
          <IconSparkles /> Try Screenshot AI
        </button>
      </section>

      {/* Recommended Places */}
      <section className="space-y-4">
        <div>
          <div className="text-xs font-bold text-teal-600 tracking-wider">02 // PLACES</div>
          <h2 className="text-xl font-black text-slate-800">Places to Visit</h2>
        </div>

        {recommendationsLoading ? (
          <p className="py-8 text-sm text-slate-500" role="status">
            Loading recommended places…
          </p>
        ) : recommendationsError ? (
          <div className="py-6 text-sm text-red-700" role="alert">
            <p>{recommendationsError}</p>
            <button
              className="mt-2 font-semibold underline"
              onClick={retryLoad}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : recommendations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendations.map(place => (
            <PlaceCard
              key={place.id}
              place={place}
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
        ) : (
          <p className="py-8 text-sm text-slate-500">
            No recommended places are available yet.
          </p>
        )}
      </section>

    </div>
  );
}