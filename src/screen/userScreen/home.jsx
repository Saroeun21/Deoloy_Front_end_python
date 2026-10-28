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

const HERO_FALLBACK_SLIDES = [
  {
    title: 'Bali, Indonesia',
    desc: 'Find your next escape among tropical coastlines and island temples.',
    img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=85',
  },
  {
    title: 'Bangkok',
    desc: 'Explore vibrant city streets, local markets, and golden temples.',
    img: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=1200&q=85',
  },
  {
    title: 'Phuket',
    desc: 'Plan a getaway to bright blue water and peaceful beaches.',
    img: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1200&q=85',
  },
];

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
  const [activeHeroSlideIndex, setActiveHeroSlideIndex] = useState(0);
  const [isHeroFocused, setIsHeroFocused] = useState(false);
  const [heroTimerResetKey, setHeroTimerResetKey] = useState(0);

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
  const apiHeroSlides = [...destinations, ...recommendations]
    .filter((destination) => destination.img)
    .filter(
      (destination, index, slides) =>
        slides.findIndex((slide) => slide.img === destination.img) === index,
    )
    .slice(0, 5);
  const heroSlides = [...apiHeroSlides, ...HERO_FALLBACK_SLIDES]
    .filter(
      (slide, index, slides) =>
        slides.findIndex((candidate) => candidate.img === slide.img) === index,
    )
    .slice(0, 5);
  const activeHeroSlide = heroSlides.length
    ? heroSlides[activeHeroSlideIndex % heroSlides.length]
    : null;

  useEffect(() => {
    if (isHeroFocused || heroSlides.length < 2) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveHeroSlideIndex((index) => (index + 1) % heroSlides.length);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [heroSlides.length, heroTimerResetKey, isHeroFocused]);

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
    <div className="min-h-screen space-y-8 bg-slate-50 pb-16 text-slate-800">
      {/* Hero Banner */}
      <section
        className="relative flex min-h-[70dvh] items-center justify-center overflow-hidden bg-[#031e1c] px-4 py-10 text-white shadow-xl sm:px-6 sm:py-12 md:px-10 md:py-14 max-sm:min-h-[calc(100dvh-7rem)]"
        onFocusCapture={() => setIsHeroFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsHeroFocused(false);
          }
        }}
      >
        <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
          <div className="home-hero-background absolute">
            {activeHeroSlide?.img && (
              <img
                key={activeHeroSlide.img}
                src={activeHeroSlide.img}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
                className="home-hero-image"
              />
            )}
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(3,30,28,0.48),rgba(3,30,28,0.42))]" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-5xl space-y-5 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold border border-teal-500/30">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          TRIPOS TRAVEL WORKSPACE
          </div>
          
          <div key={activeHeroSlide?.img || 'default'} className="home-hero-copy">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              {activeHeroSlide ? (
                <>
                  Discover{' '}
                  <span className="bg-gradient-to-r from-teal-200 to-cyan-400 bg-clip-text text-transparent">
                    {activeHeroSlide.title}
                  </span>
                </>
              ) : (
                <>
                  Where will you{' '}
                  <span className="bg-gradient-to-r from-teal-200 to-cyan-400 bg-clip-text text-transparent">
                    go next?
                  </span>
                </>
              )}
            </h1>

            <p className="mx-auto max-w-xl text-sm leading-6 text-slate-300">
              {activeHeroSlide?.desc ||
                'Discover places, plan your trip, manage your budget, and keep everything in one calm workspace.'}
            </p>
          </div>

          {/* Search Box */}
          <div className="mt-7 space-y-4 rounded-2xl bg-white p-4 text-left text-slate-800 shadow-2xl sm:p-5 md:p-6">
            <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 pb-3 text-sm font-semibold">
              {['All', 'Destinations'].map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 transition ${
                    activeTab === tab ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-12">
              <div className="col-span-2 flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-5">
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
                  placeholder="Search destinations..."
                  className="w-full min-w-0 bg-transparent text-sm font-medium text-slate-800 outline-none"
                />
              </div>

              <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 md:col-span-3 md:gap-3 md:px-4">
                <IconCalendar />
                <div>
                  <div className="text-[9px] font-bold uppercase leading-4 text-slate-400 sm:text-[10px]">DESTINATIONS</div>
                  <div className="text-sm font-semibold text-slate-700">
                    {destinationsLoading ? 'Loading…' : destinations.length}
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 md:col-span-3 md:gap-3 md:px-4">
                <IconUsers />
                <div>
                  <div className="text-[9px] font-bold uppercase leading-4 text-slate-400 sm:text-[10px]">PLACES TO VISIT</div>
                  <div className="text-sm font-semibold text-slate-700">
                    {recommendationsLoading ? 'Loading…' : recommendations.length}
                  </div>
                </div>
              </div>

              <button 
                type="button"
                onClick={openDestinationSearch}
                aria-label="Search destinations"
                className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-700 md:col-span-1 md:min-h-0 md:p-4"
              >
                <span className="md:hidden">Search destinations</span>
                <IconArrowRight />
              </button>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-sm flex-col items-stretch justify-center gap-3 pt-2 sm:max-w-none sm:flex-row sm:items-center sm:gap-4">
            <button 
              type="button"
              onClick={() => navigate('/explore')}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-700 sm:w-auto sm:py-2.5 sm:text-xs"
            >
              Explore Destinations <IconArrowRight />
            </button>
            <button 
              type="button"
              onClick={() => navigate('/trips')}
              className="min-h-12 w-full rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto sm:py-2.5 sm:text-xs"
            >
              Plan a Trip
            </button>
          </div>
        </div>
        {heroSlides.length > 1 && (
          <div
            aria-label="Hero slides"
            className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center justify-center"
            role="group"
          >
            {heroSlides.map((slide, index) => (
              <button
                key={slide.id ?? slide.img}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                aria-pressed={index === activeHeroSlideIndex % heroSlides.length}
                onClick={() => {
                  setActiveHeroSlideIndex(index);
                  setHeroTimerResetKey((key) => key + 1);
                }}
                className="group grid h-8 w-8 cursor-pointer place-items-center"
              >
                <span
                  className={`h-2 w-2 rounded-full transition duration-300 group-hover:scale-150 ${
                    index === activeHeroSlideIndex % heroSlides.length
                      ? 'scale-125 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]'
                      : 'bg-white/40 group-hover:bg-white/80'
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Popular Destinations */}
      <section className="mx-4 space-y-4 sm:mx-6 md:mx-8">
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
      <section className="mx-4 flex flex-col items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-slate-900 p-5 text-white shadow-lg sm:mx-6 sm:p-6 md:mx-8 md:flex-row">
        <div className="space-y-2 max-w-xl">
          <span className="bg-teal-500/30 text-teal-200 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border border-teal-400/30">
            Komsan Screenshot AI 2.0
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
      <section className="mx-4 space-y-4 sm:mx-6 md:mx-8">
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