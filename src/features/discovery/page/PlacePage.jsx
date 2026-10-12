import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  Info,
  MapPin,
  Navigation,
  Plus,
  ShieldAlert,
  Sparkles,
  Ticket,
  TrainFront,
  Utensils,
  Volume2,
  X,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  getDestinationById,
  getRecommendedPlaces,
} from '../../../services/api/destinationservices';
import { fetchPlaceById } from '../../../services/api/placeapi';
import { getPlaceDetailPath } from './placeRoutes';
import { getSavedItemKey } from './components/savedItemKey';
import { getWikipediaPlaceById } from '../../../services/api/wikipediaPlaces';
import {
  fetchWikimediaQuery,
  WIKIMEDIA_COMMONS_API_URL,
  WIKIPEDIA_API_URL,
} from '../../../services/api/wikimediaApi';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80';
const TABS = ['Overview & Highlights', "What's Inside", 'Audio Tour Map'];
const PHOTO_QUERY_LIMIT = 5;
const PHOTO_SEARCH_LIMIT = 17;

function normalizeDestination(destination) {
  if (!destination) return null;
  return {
    ...destination,
    kind: 'destination',
    title:
      destination.title ||
      (destination.country
        ? `${destination.name}, ${destination.country}`
        : destination.name),
    desc: destination.desc || destination.description || '',
    location:
      destination.location ||
      [destination.name, destination.country].filter(Boolean).join(', '),
    img: destination.img || destination.image || '',
  };
}

function getDistanceInMeters(from, to) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findPlaceCoordinates(destination) {
  const title = destination.title || destination.name;
  const location = destination.location || destination.country || '';
  const query = `${title} ${location}`.trim();
  if (!query) return null;

  const result = await fetchWikimediaQuery(WIKIPEDIA_API_URL, {
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '0',
    gsrlimit: '10',
    prop: 'coordinates|pageprops',
    coprop: 'type|globe',
  });
  const titleWords = title
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
  const pages = (Array.isArray(result.pages) ? result.pages : [])
    .map((page) => {
      const pageTitle = page.title.toLocaleLowerCase();
      const matchingWords = titleWords.filter((word) =>
        pageTitle.includes(word),
      ).length;
      const point = page.coordinates?.find(
        (coordinate) => !coordinate.globe || coordinate.globe === 'earth',
      );
      return point ? { point, matchingWords } : null;
    })
    .filter((item) => item && item.matchingWords > 0)
    .sort((left, right) => right.matchingWords - left.matchingWords);
  const point = pages[0]?.point;

  return point
    ? { latitude: point.lat, longitude: point.lon }
    : null;
}

async function fetchNearbyDiningPlaces(center) {
  const photonParams = new URLSearchParams({
    q: 'restaurant',
    lat: String(center.latitude),
    lon: String(center.longitude),
    limit: '10',
    lang: 'en',
  });
  try {
    const response = await fetch(
      `https://photon.komoot.io/api/?${photonParams.toString()}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) {
      throw new Error(`Nearby restaurant search failed (HTTP ${response.status}).`);
    }
    const data = await response.json();
    const places = (data.features || [])
      .filter((feature) => feature.properties?.name)
      .map((feature, index) => {
        const [longitude, latitude] = feature.geometry?.coordinates || [];
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }
        return {
          id: `photon-${feature.properties.osm_id || index}`,
          title: feature.properties.name,
          cuisine: feature.properties.cuisine,
          amenity: feature.properties.osm_value || 'restaurant',
          distance: getDistanceInMeters(center, { latitude, longitude }),
          latitude,
          longitude,
        };
      })
      .filter((place) => place && place.distance <= 5000)
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 5);
    if (places.length > 0) return places;
  } catch (error) {
    console.warn('Photon nearby restaurant lookup failed:', error);
  }

  const query = `[out:json][timeout:15];(node["amenity"~"restaurant|cafe|food_court|fast_food|bakery"](around:3000,${center.latitude},${center.longitude});way["amenity"~"restaurant|cafe|food_court|fast_food|bakery"](around:3000,${center.latitude},${center.longitude}););out center tags 20;`;
  const params = new URLSearchParams({ data: query });
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  let lastError;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(
        `${endpoint}?${params.toString()}`,
        { signal: AbortSignal.timeout(15000) },
      );
      if (!response.ok) {
        throw new Error(
          `Nearby dining search failed (HTTP ${response.status}).`,
        );
      }
      const data = await response.json();
      const places = (data.elements || [])
        .filter((element) => element.tags?.name)
        .map((element) => {
          const latitude = element.lat ?? element.center?.lat;
          const longitude = element.lon ?? element.center?.lon;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null;
          }
          return {
            id: `${element.type}-${element.id}`,
            title: element.tags.name,
            cuisine: element.tags.cuisine,
            amenity: element.tags.amenity,
            distance: getDistanceInMeters(center, { latitude, longitude }),
            latitude,
            longitude,
          };
        })
        .filter(Boolean)
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 5);
      return places;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Could not load nearby dining from OpenStreetMap: ${
      lastError instanceof Error ? lastError.message : 'Unknown error.'
    }`,
  );
}

async function fetchNearbyPlacePhoto(name, location) {
  const result = await fetchWikimediaQuery(WIKIMEDIA_COMMONS_API_URL, {
    generator: 'search',
    gsrsearch: `${name} ${location} restaurant`,
    gsrnamespace: '6',
    gsrlimit: '1',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '400',
  });
  return result.pages?.[0]?.imageinfo?.[0]?.thumburl || '';
}

function toImageUrl(image) {
  if (!image || typeof image !== 'string') return '';
  if (/^(?:https?:|data:)/i.test(image)) return image;
  return new URL(image.replace(/^\/+/, ''), window.location.origin).toString();
}

function formatAddress(destination) {
  return (
    destination.address ||
    destination.location ||
    [destination.city, destination.country].filter(Boolean).join(', ') ||
    'Address not listed'
  );
}

function isValidCoordinate(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function InfoMetric({ icon: Icon, label, value, detail }) {
  return (
    <div className="flex min-w-0 gap-3 p-4 sm:p-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
        <Icon size={19} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 truncate text-sm font-bold text-slate-900">{value}</p>
        {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, eyebrow, title, children }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
          <Icon size={19} />
        </span>
        <div>
          {eyebrow && (
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">
              {eyebrow}
            </p>
          )}
          <h2 className="mt-1 text-base font-bold text-slate-900">{title}</h2>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Notice({ icon: Icon, title, children, tone = 'red' }) {
  const styles =
    tone === 'red'
      ? {
          box: 'border-red-100 bg-red-50/80',
          icon: 'bg-red-100 text-red-700',
          title: 'text-red-950',
        }
      : {
          box: 'border-amber-100 bg-amber-50',
          icon: 'bg-amber-100 text-amber-700',
          title: 'text-amber-950',
        };
  return (
    <section className={`rounded-2xl border p-5 sm:p-6 ${styles.box}`}>
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${styles.icon}`}>
          <Icon size={20} />
        </span>
        <h2 className={`text-base font-bold ${styles.title}`}>{title}</h2>
      </div>
      <div className="mt-4 text-sm leading-6 text-slate-700">{children}</div>
    </section>
  );
}

function PlacePage({
  savedItemKeys = [],
  onToggleSave = () => {},
  savingPlaceIds = [],
}) {
  const { placeType, placeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const routeDestination = location.state?.destination;
  const hasRouteDestination =
    routeDestination && String(routeDestination.id) === placeId;
  const routeKey = `${placeType || 'legacy'}:${placeId}`;
  const [loadedPlace, setLoadedPlace] = useState(null);
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [nearbyDining, setNearbyDining] = useState([]);
  const [nearbyLoadedPlaceId, setNearbyLoadedPlaceId] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [resolvedCoordinates, setResolvedCoordinates] = useState(null);
  const [loadError, setLoadError] = useState('');
  const fetchedDestination =
    loadedPlace?.routeKey === routeKey ? loadedPlace.destination : null;
  const isLoading = !hasRouteDestination && loadedPlace?.routeKey !== routeKey;

  useEffect(() => {
    if (hasRouteDestination) return undefined;
    let isMounted = true;

    async function loadDestination() {
      setLoadError('');
      try {
        let destination;
        if (placeType === 'place') {
          const place = await fetchPlaceById(placeId);
          let currency;
          if (place.destination_id != null) {
            try {
              const parentDestination = await getDestinationById(
                place.destination_id,
              );
              currency = parentDestination.currency;
            } catch (error) {
              console.warn(
                'Could not load destination currency for attraction:',
                error,
              );
            }
          }
          destination = {
            ...place,
            kind: 'place',
            currency,
            title: place.name,
            desc: place.description || '',
            location: place.address || '',
            img: place.image || '',
          };
        } else if (placeType === 'destination') {
          destination = normalizeDestination(await getDestinationById(placeId));
        } else if (placeId.startsWith('wiki-')) {
          destination = await getWikipediaPlaceById(
            placeId.slice('wiki-'.length),
          );
        } else {
          destination = normalizeDestination(await getDestinationById(placeId));
          if (!destination) {
            const places = await getRecommendedPlaces();
            destination = (Array.isArray(places) ? places : []).find(
              (place) => String(place.id) === placeId,
            );
            if (destination) {
              destination = {
                ...destination,
                kind: 'place',
                title: destination.title || destination.name,
                desc: destination.desc || destination.description || '',
                img: destination.img || destination.image || '',
              };
            }
          }
        }
        if (isMounted) setLoadedPlace({ routeKey, destination: destination || null });
      } catch (error) {
        if (!isMounted) return;
        console.error('Could not load attraction details:', error);
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Could not load attraction details.',
        );
        setLoadedPlace({ routeKey, destination: null });
      }
    }

    void loadDestination();
    return () => {
      isMounted = false;
    };
  }, [hasRouteDestination, placeId, placeType, routeKey]);

  const destination = hasRouteDestination ? routeDestination : fetchedDestination;

  const coordinatesBelongToPlace =
    resolvedCoordinates?.placeId === String(destination?.id);
  const latitude =
    destination?.latitude ??
    destination?.lat ??
    (coordinatesBelongToPlace ? resolvedCoordinates.latitude : undefined);
  const longitude =
    destination?.longitude ??
    destination?.lon ??
    (coordinatesBelongToPlace ? resolvedCoordinates.longitude : undefined);
  const hasCoordinates =
    isValidCoordinate(latitude) && isValidCoordinate(longitude);
  const coordinateText = hasCoordinates
    ? `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`
    : '';
  const address = destination ? formatAddress(destination) : '';
  const image = toImageUrl(
    destination?.image ||
    destination?.image_url ||
    destination?.imageUrl ||
      destination?.img ||
      destination?.thumbnail,
  );

  useEffect(() => {
    if (!destination) return undefined;
    let isMounted = true;

    async function loadGalleryAndNearbyPlaces() {
      const photoRequest = fetchWikimediaQuery(WIKIMEDIA_COMMONS_API_URL, {
        generator: 'search',
        gsrsearch: `${destination.title || destination.name} ${destination.location || ''} filetype:bitmap`,
        gsrnamespace: '6',
        gsrlimit: String(PHOTO_SEARCH_LIMIT),
        prop: 'imageinfo',
        iiprop: 'url',
        iiurlwidth: '1000',
      }).then((result) =>
        (Array.isArray(result.pages) ? result.pages : [])
          .map((page) => ({
            src: page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url,
            title: page.title?.replace(/^File:/, '').replace(/\.[^.]+$/, ''),
            sourceUrl: page.imageinfo?.[0]?.descriptionurl,
          }))
          .filter((photo) => photo.src),
      );

      const nearbyRequest = (async () => {
        const center = hasCoordinates
          ? { latitude: Number(latitude), longitude: Number(longitude) }
          : await findPlaceCoordinates(destination);
        if (!center) {
          return { sights: [], dining: [], center: null };
        }
        const [sightsResult, diningResult] = await Promise.allSettled([
          fetchWikimediaQuery(WIKIPEDIA_API_URL, {
            generator: 'geosearch',
            ggscoord: `${center.latitude}|${center.longitude}`,
            ggsradius: '5000',
            ggslimit: '12',
            ggsnamespace: '0',
            prop: 'coordinates|pageimages|extracts|pageprops',
            coprop: 'type|globe',
          }),
          fetchNearbyDiningPlaces(center),
        ]);
        const sights =
          sightsResult.status === 'fulfilled'
            ? (Array.isArray(sightsResult.value.pages)
                ? sightsResult.value.pages
                : []
              )
                .filter(
                  (page) => {
                    const articleSummary =
                      `${page.title} ${page.extract || ''}`;
                    return (
                      page.title !== (destination.title || destination.name) &&
                      !/\b(?:rebellion|civil war|war|battle|incident|campaign|conquest|siege)\b/i.test(
                        articleSummary,
                      ) &&
                      page.coordinates?.some(
                        (coordinate) =>
                          (!coordinate.globe ||
                            coordinate.globe === 'earth') &&
                          coordinate.type !== 'event' &&
                          coordinate.type !== 'astronomical object',
                      )
                    );
                  },
                )
                .sort((left, right) => (left.dist || 0) - (right.dist || 0))
                .map((page) => ({
                  id: `wiki-${page.pageid}`,
                  title: page.title,
                  desc: page.extract || '',
                  img: page.thumbnail?.source || '',
                  distance: page.dist,
                  sourceUrl: `https://en.wikipedia.org/?curid=${page.pageid}`,
                  kind: 'place',
                }))
            : [];
        if (sightsResult.status === 'rejected') {
          console.warn('Could not load nearby attractions:', sightsResult.reason);
        }
        if (diningResult.status === 'rejected') {
          console.warn('Could not load nearby dining:', diningResult.reason);
        }
        const dining =
          diningResult.status === 'fulfilled' ? diningResult.value : [];
        const diningWithPhotos = await Promise.all(
          dining.slice(0, 4).map(async (place) => {
            try {
              return {
                ...place,
                image: await fetchNearbyPlacePhoto(
                  place.title,
                  destination.location || destination.country || '',
                ),
              };
            } catch (error) {
              console.warn(`Could not load photo for ${place.title}:`, error);
              return place;
            }
          }),
        );
        return {
          sights,
          dining: diningWithPhotos,
          center,
        };
      })();

      const [photoResult, nearbyResult] = await Promise.allSettled([
        photoRequest,
        nearbyRequest,
      ]);
      if (!isMounted) return;
      if (photoResult.status === 'fulfilled') {
        setGalleryPhotos(photoResult.value);
      } else {
        console.warn('Could not load attraction gallery:', photoResult.reason);
        setGalleryPhotos([]);
      }
      if (nearbyResult.status === 'fulfilled') {
        setNearbyPlaces(nearbyResult.value.sights);
        setNearbyDining(nearbyResult.value.dining);
        if (
          nearbyResult.value.center &&
          !hasCoordinates &&
          isValidCoordinate(nearbyResult.value.center.latitude) &&
          isValidCoordinate(nearbyResult.value.center.longitude)
        ) {
          setResolvedCoordinates({
            placeId: String(destination.id),
            ...nearbyResult.value.center,
          });
        }
      } else {
        console.warn('Could not load nearby attractions:', nearbyResult.reason);
        setNearbyPlaces([]);
        setNearbyDining([]);
      }
      setNearbyLoadedPlaceId(String(destination.id));
    }

    void loadGalleryAndNearbyPlaces();
    return () => {
      isMounted = false;
    };
  }, [destination, hasCoordinates, latitude, longitude]);

  useEffect(() => {
    if (!selectedPhoto) return undefined;
    function closeOnEscape(event) {
      if (event.key === 'Escape') setSelectedPhoto(null);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedPhoto]);

  const isSaved = destination
    ? savedItemKeys.includes(getSavedItemKey(destination))
    : false;
  const isSaving = destination
    ? savingPlaceIds.includes(getSavedItemKey(destination))
    : false;
  const gallery = useMemo(() => {
    const images = [
      image,
      ...galleryPhotos
        .map((photo) => photo.src)
        .filter((photo) => photo !== image),
    ].filter(Boolean);
    return images.length > 0 ? images.slice(0, PHOTO_QUERY_LIMIT) : [FALLBACK_IMAGE];
  }, [galleryPhotos, image]);
  const galleryMoreCount = Math.max(
    0,
    galleryPhotos.length - (image ? PHOTO_QUERY_LIMIT - 1 : PHOTO_QUERY_LIMIT),
  );
  const sights = nearbyPlaces.filter((place) => place.kind === 'place');
  const isNearbyLoading =
    !destination || nearbyLoadedPlaceId !== String(destination.id);
  const directionsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${destination?.title || destination?.name} ${address}`,
      )}`;

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 p-5 sm:p-8">
        <div className="mx-auto max-w-7xl animate-pulse space-y-5">
          <div className="h-8 w-40 rounded-lg bg-slate-200" />
          <div className="h-24 rounded-2xl bg-slate-200" />
          <div className="h-[420px] rounded-3xl bg-slate-200" />
          <div className="h-32 rounded-2xl bg-slate-200" />
        </div>
      </main>
    );
  }

  if (!destination) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            {loadError ? 'Could not load this place' : 'Place not found'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {loadError ||
              'This place may no longer be available. Explore destinations to find another.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/explore')}
            className="mt-6 rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-800"
          >
            Back to Explore
          </button>
        </section>
      </main>
    );
  }

  const title = destination.title || destination.name || 'Place details';
  const category =
    destination.category || destination.type || 'Travel attraction';
  const description =
    destination.desc ||
    destination.description ||
    'Explore the landmark, learn about its history, and plan your visit.';
  const hours =
    destination.opening_time && destination.closing_time
      ? `${destination.opening_time} – ${destination.closing_time}`
      : 'Check before visiting';
  const admission =
    (destination.admission_fee_usd == null
      ? null
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 2,
        }).format(Number(destination.admission_fee_usd))) ??
    'Check official listing';
  const duration =
    destination.suggested_duration ||
    destination.duration ||
    'Allow time to explore';
  const attractionFeatures = [
    {
      icon: Info,
      title: 'A place worth exploring',
      text: description,
    },
    {
      icon: MapPin,
      title: 'Find your way around',
      text: address,
    },
    {
      icon: Clock3,
      title: 'Plan ahead',
      text: 'Check current opening hours and visitor guidance before setting out.',
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-800 sm:px-7 sm:py-8 lg:px-9">
      <div className="mx-auto max-w-7xl space-y-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <header className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg bg-teal-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-teal-800">
              {category}
            </span>
            <span className="rounded-lg bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200">
              {destination.location || destination.country || 'Attraction'}
            </span>
          </div>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <h1 className="max-w-4xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-[2.7rem]">
                {title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                {destination.rating ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                    <span className="text-amber-500">★</span>
                    {destination.rating}
                    {destination.reviews && (
                      <span className="font-normal text-slate-500">
                        ({destination.reviews})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Info size={15} />
                    Visitor rating not listed
                  </span>
                )}
                <span className="hidden h-4 w-px bg-slate-200 sm:block" />
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={15} className="text-teal-700" />
                  {address}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {destination && (
                <button
                  type="button"
                  onClick={() => onToggleSave(destination)}
                  disabled={isSaving}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${
                    isSaved
                      ? 'border-teal-200 bg-teal-50 text-teal-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {isSaved ? <Check size={16} /> : <Plus size={16} />}
                  {isSaved
                    ? 'Saved'
                    : destination.kind === 'destination'
                      ? 'Save destination'
                      : 'Save place'}
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  navigate('/trips', { state: { addDestination: destination } })
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800"
              >
                <Plus size={16} />
                Add to My Trip
              </button>
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <Navigation size={16} />
                Directions
              </a>
            </div>
          </div>
        </header>

        <section
          aria-label="Photo gallery"
          className="place-detail-gallery"
        >
          <button
            type="button"
            onClick={() => setSelectedPhoto({ src: gallery[0], title })}
            aria-label={`Enlarge photo of ${title}`}
            className="place-detail-gallery__hero group relative block overflow-hidden bg-slate-200 text-left"
          >
            <img
              src={gallery[0]}
              alt={title}
              className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
              onError={(event) => {
                event.currentTarget.src = FALLBACK_IMAGE;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-slate-950/10" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white sm:p-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100">
                  Featured attraction
                </p>
                <h2 className="mt-2 text-xl font-bold sm:text-2xl">{title}</h2>
                <p className="mt-1 text-sm text-white/80">{address}</p>
              </div>
              {destination.sourceUrl && (
                <a
                  href={destination.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden shrink-0 items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/25 sm:inline-flex"
                >
                  View source <ExternalLink size={13} />
                </a>
              )}
            </div>
            <span className="absolute right-4 top-4 rounded-lg bg-slate-950/50 px-3 py-2 text-xs font-semibold text-white opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
              Enlarge photo
            </span>
          </button>
          <div className="place-detail-gallery__tiles">
            {[1, 2, 3, 4].map((index) => {
              const photo = gallery[index] || gallery[0];
              return (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedPhoto({
                      src: photo,
                      title: galleryPhotos[index - 1]?.title || `${title} view`,
                      sourceUrl: galleryPhotos[index - 1]?.sourceUrl,
                    })
                  }
                  aria-label={`Enlarge ${galleryPhotos[index - 1]?.title || `${title} photo`}`}
                  key={`${photo}-${index}`}
                  className="place-detail-gallery__tile group relative block overflow-hidden bg-slate-200 text-left"
                >
                  <img
                    src={photo}
                    alt={`${title} view ${index}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK_IMAGE;
                    }}
                  />
                  {index === 4 && galleryMoreCount > 0 && (
                    <div className="absolute inset-0 grid place-items-center bg-slate-950/55 text-sm font-bold text-white">
                      +{galleryMoreCount} more photos
                    </div>
                  )}
                  <span className="absolute right-2 top-2 rounded-md bg-slate-950/45 px-2 py-1 text-[10px] font-semibold text-white opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    Enlarge
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {destination.sourceUrl && (
          <p className="-mt-3 text-right text-[11px] text-slate-500">
            Place information from{' '}
            <a
              href={destination.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-teal-700 underline"
            >
              Wikipedia article
            </a>
          </p>
        )}

        <section className="grid grid-cols-1 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          <InfoMetric
            icon={Clock3}
            label="Operating hours"
            value={hours}
            detail="Hours may change on holidays"
          />
          <InfoMetric
            icon={Ticket}
            label="Admission (USD)"
            value={admission ?? 'Not listed'}
            detail="Confirm current ticket details"
          />
          <InfoMetric
            icon={CalendarDays}
            label="Suggested visit"
            value={duration}
            detail="Plan extra time for queues"
          />
          <InfoMetric
            icon={AudioLines}
            label="Audio guide"
            value={
              destination.audio_guide
                ? 'Available'
                : 'Check on arrival'
            }
            detail={destination.audio_guide_languages || 'Languages not listed'}
          />
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.95fr)]">
          <div className="space-y-6">
            <Notice icon={ShieldAlert} title="Visitor information to check" tone="red">
              <p>
                Dress requirements and access rules vary by attraction. Check the
                official visitor guidance before you leave, especially for
                religious or ceremonial sites.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/80 bg-white/80 p-4">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-800">
                    <Check size={15} /> Safer choices
                  </p>
                  <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
                    <li>Choose modest, comfortable clothing.</li>
                    <li>Keep a light cover-up in your day bag.</li>
                    <li>Follow signs and staff instructions on site.</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-white/80 bg-white/80 p-4">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-800">
                    <X size={15} /> Check restrictions
                  </p>
                  <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
                    <li>Do not assume every outfit is permitted.</li>
                    <li>Avoid clothing that conflicts with posted rules.</li>
                    <li>Do not rely on unofficial rental offers.</li>
                  </ul>
                </div>
              </div>
              <p className="mt-3 rounded-xl bg-white/80 px-4 py-3 text-xs leading-5 text-slate-600">
                <strong className="text-slate-800">Tip:</strong> If the venue
                requires a cover-up, confirm availability and price at the
                official entrance.
              </p>
            </Notice>

            <div className="grid gap-4 md:grid-cols-2">
              <SectionCard
                icon={Clock3}
                eyebrow="Plan your visit"
                title="When to arrive"
              >
                <p className="text-sm leading-6 text-slate-600">
                  Arriving early can mean cooler weather and a calmer first
                  hour. Confirm opening times and the final-entry policy with
                  the attraction before travelling.
                </p>
                <div className="mt-4 space-y-2">
                  {[
                    ['Morning', 'Arrive near opening for a quieter visit.'],
                    ['Peak hours', 'Expect more visitors around midday.'],
                    ['Final entry', 'Check the official closing and last-entry time.'],
                  ].map(([period, advice], index) => (
                    <div
                      key={period}
                      className="flex gap-3 rounded-xl bg-slate-50 p-3"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-800">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{period}</p>
                        <p className="mt-0.5 text-xs leading-5 text-slate-500">
                          {advice}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                icon={TrainFront}
                eyebrow="Getting there"
                title="Plan your route"
              >
                <p className="text-sm leading-6 text-slate-600">
                  Choose the route that best fits your starting point. Use a
                  live map for current transit information.
                </p>
                <ol className="mt-4 space-y-3">
                  {[
                    ['Transit', 'Check the closest rail, bus, or ferry stop.'],
                    ['Connect', 'Follow current route guidance to the site.'],
                    ['Walk', 'Use the signed entrance and marked public paths.'],
                  ].map(([step, advice], index) => (
                    <li key={step} className="flex gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-teal-700 text-xs font-bold text-white">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{step}</p>
                        <p className="mt-0.5 text-xs leading-5 text-slate-500">
                          {advice}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900"
                >
                  Open directions <ArrowRight size={14} />
                </a>
              </SectionCard>
            </div>

            <Notice icon={ShieldAlert} title="Watch out for unofficial offers" tone="amber">
              <p>
                Be cautious of anyone claiming an attraction is closed and
                offering an alternate tour or ticket nearby. Verify closures
                directly with the venue and buy tickets only from an official
                channel.
              </p>
              <div className="mt-3 rounded-xl border border-amber-200 bg-white/80 p-4 text-xs leading-5 text-amber-950">
                <strong>Before you go:</strong> Check official hours, use the
                marked entrance, and politely decline unsolicited ticket or
                transport offers.
              </div>
            </Notice>

            <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4 sm:p-5">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                      activeTab === tab
                        ? 'bg-teal-700 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="p-5 sm:p-7">
                {activeTab === TABS[0] && (
                  <>
                    <p className="text-sm leading-7 text-slate-600">
                      {description}
                    </p>
                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      {attractionFeatures.map(({ icon: Icon, title: featureTitle, text }) => (
                        <article
                          key={featureTitle}
                          className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                        >
                          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-teal-700 shadow-sm">
                            <Icon size={17} />
                          </span>
                          <h3 className="mt-3 text-sm font-bold text-slate-900">
                            {featureTitle}
                          </h3>
                          <p className="mt-1 line-clamp-4 text-xs leading-5 text-slate-500">
                            {text}
                          </p>
                        </article>
                      ))}
                    </div>
                  </>
                )}
                {activeTab === TABS[1] && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold text-slate-900">
                      Explore at your own pace
                    </h2>
                    <p className="text-sm leading-7 text-slate-600">
                      Start with the main attraction, then look for notable
                      architecture, exhibits, viewpoints, and visitor
                      information available on site. The nearby list is based
                      on mapped Wikipedia entries when location coordinates are
                      available.
                    </p>
                    <p className="text-xs leading-5 text-slate-500">
                      Specific highlights and access details are not available
                      for every place. Follow local signs and official visitor
                      guidance.
                    </p>
                  </div>
                )}
                {activeTab === TABS[2] && (
                  <div className="rounded-xl bg-slate-50 p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-100 text-teal-800">
                        <Volume2 size={19} />
                      </span>
                      <div>
                        <h2 className="font-bold text-slate-900">
                          Audio and map planning
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {destination.audio_guide
                            ? `Audio guide: ${destination.audio_guide_languages || 'availability and languages should be confirmed at the venue.'}`
                            : 'Audio-guide availability is not listed. Ask the venue about guided tours and language options.'}
                        </p>
                        {hasCoordinates && (
                          <p className="mt-3 text-xs font-medium text-slate-500">
                            Attraction coordinates: {coordinateText}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-5">
            <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-teal-700">
                    Location
                  </p>
                  <h2 className="mt-1 text-sm font-bold text-slate-900">
                    {title}
                  </h2>
                </div>
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open directions"
                  className="grid h-9 w-9 place-items-center rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100"
                >
                  <ArrowDownRight size={17} />
                </a>
              </div>
              {hasCoordinates ? (
                <iframe
                  title={`Map showing ${title}`}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(longitude) - 0.025}%2C${Number(latitude) - 0.018}%2C${Number(longitude) + 0.025}%2C${Number(latitude) + 0.018}&layer=mapnik&marker=${latitude}%2C${longitude}`}
                  className="h-56 w-full border-0 bg-slate-100"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="grid h-56 place-items-center bg-gradient-to-br from-teal-50 via-slate-100 to-emerald-50 p-6 text-center">
                  <div>
                    <MapPin className="mx-auto text-teal-700" size={26} />
                    <p className="mt-2 text-sm font-bold text-slate-800">
                      {address}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Map coordinates are not available for this place.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 p-4">
                <p className="min-w-0 truncate text-xs text-slate-500">
                  {hasCoordinates ? coordinateText : address}
                </p>
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs font-bold text-teal-700"
                >
                  Directions
                </a>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-teal-700">
                    Explore nearby
                  </p>
                  <h2 className="mt-1 text-base font-bold text-slate-900">
                    Nearby sights
                  </h2>
                </div>
                {(hasCoordinates || coordinatesBelongToPlace) && (
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
                    Nearby
                  </span>
                )}
              </div>
              <div className="mt-3 divide-y divide-slate-100">
                {isNearbyLoading && (
                  <p className="py-4 text-xs text-slate-500">
                    Finding nearby places…
                  </p>
                )}
                {sights.slice(0, 4).map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() =>
                      navigate(getPlaceDetailPath(place), {
                        state: { destination: place },
                      })
                    }
                    className="flex w-full items-center gap-3 py-3 text-left"
                  >
                    <img
                      src={place.img || image || FALLBACK_IMAGE}
                      alt=""
                      className="h-14 w-16 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
                        {place.title}
                    </span>
                  </button>
                ))}
                {!isNearbyLoading && sights.length === 0 && (
                  <p className="py-4 text-xs leading-5 text-slate-500">
                    {hasCoordinates || coordinatesBelongToPlace
                      ? 'No nearby sights are available from the map data.'
                      : 'Nearby places could not be located for this attraction.'}
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Utensils size={17} className="text-teal-700" />
                <h2 className="text-sm font-bold text-slate-900">
                  Food and cafés nearby
                </h2>
              </div>
              <div className="mt-3 divide-y divide-slate-100">
                {isNearbyLoading && (
                  <p className="py-3 text-xs text-slate-500">
                    Finding nearby restaurants…
                  </p>
                )}
                {nearbyDining.slice(0, 4).map((place) => (
                  <a
                    key={place.id}
                    href={`https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=17/${place.latitude}/${place.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 py-3"
                  >
                    <img
                      src={place.image || image || FALLBACK_IMAGE}
                      alt=""
                      className="h-14 w-16 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
                        {place.title}
                    </span>
                  </a>
                ))}
                {!isNearbyLoading && nearbyDining.length === 0 && (
                  <p className="py-3 text-xs leading-5 text-slate-500">
                    No nearby restaurants were found in the map listings.
                  </p>
                )}
                <p className="pt-2 text-[10px] text-slate-400">
                  Data ©{' '}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    OpenStreetMap contributors
                  </a>
                  {' · '}
                  <a
                    href="https://github.com/komoot/photon"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Photon
                  </a>
                </p>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-600 p-5 text-white shadow-sm">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
                <Sparkles size={20} />
              </span>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-100">
                TripOS AI Optimizer
              </p>
              <h2 className="mt-1 text-lg font-bold">
                Make the most of your day
              </h2>
              <p className="mt-2 text-xs leading-5 text-white/80">
                Add this attraction to a trip and plan it alongside your other
                stops.
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate('/trips', {
                    state: { addDestination: destination },
                  })
                }
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-bold text-teal-800 transition hover:bg-teal-50"
              >
                Plan this place in My Trips <ArrowRight size={15} />
              </button>
            </section>
          </aside>
        </div>
      </div>
      {selectedPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo of ${selectedPhoto.title}`}
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/90 p-3 sm:p-8"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            type="button"
            autoFocus
            aria-label="Close enlarged photo"
            onClick={() => setSelectedPhoto(null)}
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6 sm:top-6"
          >
            <X size={22} />
          </button>
          <figure
            className="flex max-h-full w-full max-w-6xl flex-col items-center gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={selectedPhoto.src}
              alt={selectedPhoto.title}
              className="max-h-[82vh] w-full rounded-xl object-contain"
            />
            <figcaption className="text-center text-sm font-medium text-white/90">
              {selectedPhoto.title}
              {selectedPhoto.sourceUrl && (
                <>
                  {' · '}
                  <a
                    href={selectedPhoto.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    Photo source
                  </a>
                </>
              )}
            </figcaption>
          </figure>
        </div>
      )}
    </main>
  );
}

export default PlacePage;
