import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Compass,
  Grid2X2,
  LayoutList,
  MapPin,
  Plane,
  Plus,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react';
import TripPlanningPanel from '../../features/trips/components/TripPlanningPanel';
import { useTripStore } from '../../features/trips/store/useTripStore.jsx';
import accommodationApi from '../../services/api/accommodation_api.js';
import checklistApi from '../../services/api/check_list_api.js';
import checklistItemApi from '../../services/api/check_list_item_api.js';
import packingApi from '../../services/api/packing_api.js';
import packingListApi from '../../services/api/packing_list_api.js';
import transportApi from '../../services/api/transport_api.js';
import expenseApi from '../../services/api/expense_api.js';
import memoryApi from '../../services/api/memory_api.js';
import memoryPhotoApi from '../../services/api/memory_photo_api.js';
import reminderApi from '../../services/api/reminderapi.js';
import { createDestination } from '../../services/api/destinationapi.js';
import { getHomeDestinations } from '../../services/api/homeApi.js';
import { resolveApiUrl } from '../../services/api/httpClient.js';
import {
  getTrips,
  deleteTrip,
} from '../../services/api/tripService';

function formatDateInput(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function createEmptyTripForm() {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  return {
    destinationId: '',
    name: '',
    description: '',
    startDate: formatDateInput(startDate),
    endDate: formatDateInput(endDate),
    currency: 'USD',
    budgetAmount: '',
    imageUrl: '',
  };
}

function parseTripDate(value) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTripGroup(trip, today = new Date()) {
  const status = String(trip.status || '').toLowerCase();
  const startDate = parseTripDate(trip.start_date);
  const endDate = parseTripDate(trip.end_date);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (status === 'draft') return 'drafts';
  if (status === 'completed' || status === 'cancelled' || (endDate && endDate < todayDate)) {
    return 'past';
  }
  if (
    status === 'ongoing' ||
    (startDate && endDate && startDate <= todayDate && endDate >= todayDate)
  ) {
    return 'active';
  }
  return 'upcoming';
}

function formatTripDateRange(startValue, endValue) {
  const startDate = parseTripDate(startValue);
  const endDate = parseTripDate(endValue);
  if (!startDate || !endDate) return 'Dates not set';

  const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const start = new Intl.DateTimeFormat(undefined, dateOptions).format(startDate);
  const end = new Intl.DateTimeFormat(undefined, dateOptions).format(endDate);
  const days = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1,
  );
  return `${start} – ${end} · ${days} ${days === 1 ? 'day' : 'days'}`;
}

function formatTripBudget(amount, currency = 'USD') {
  if (amount == null || amount === '') return 'Budget not set';
  const value = Number(amount);
  if (!Number.isFinite(value)) return 'Budget not set';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: /^[A-Za-z]{3}$/.test(currency) ? currency : 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return `${currency} ${value.toLocaleString()}`;
  }
}

function Trip() {
  const navigate = useNavigate();
  const location = useLocation();
  const { createTrip: createTripFromStore, endTrip } = useTripStore();
  const loadTask = useRef(null);
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tripResources, setTripResources] = useState({
    accommodations: [],
    checklists: [],
    checklistItems: [],
    packingItems: [],
    packingLists: [],
    transports: [],
    expenses: [],
    reminders: [],
    memories: [],
    memoryPhotos: [],
    errors: {},
  });
  const [isLoadingResources, setIsLoadingResources] = useState(true);

  // Modal State for Adding a New Trip
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [destinations, setDestinations] = useState([]);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(true);
  const [destinationError, setDestinationError] = useState('');
  const [isCreatingDestination, setIsCreatingDestination] = useState(false);
  const [isSavingDestination, setIsSavingDestination] = useState(false);
  const [destinationFormError, setDestinationFormError] = useState('');
  const [destinationForm, setDestinationForm] = useState({
    name: '',
    country: '',
    countryCode: '',
    currency: '',
    description: '',
  });
  const [formData, setFormData] = useState(createEmptyTripForm);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isGridView, setIsGridView] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDestinations() {
      try {
        const result = await getHomeDestinations(100);
        if (!cancelled) {
          setDestinations(result);
          setDestinationError('');
        }
      } catch (error) {
        if (!cancelled) {
          setDestinationError(
            error instanceof Error ? error.message : 'Could not load destinations.',
          );
        }
      } finally {
        if (!cancelled) setIsLoadingDestinations(false);
      }
    }

    void loadDestinations();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadTripResources = useCallback(async () => {
    const results = await Promise.allSettled([
      accommodationApi.list(),
      checklistApi.list(),
      checklistItemApi.list(),
      packingApi.list(),
      packingListApi.list(),
      transportApi.list(),
      expenseApi.list(),
      reminderApi.list(),
      memoryApi.list(),
      memoryPhotoApi.list(),
    ]);
    const keys = [
      'accommodations',
      'checklists',
      'checklistItems',
      'packingItems',
      'packingLists',
      'transports',
      'expenses',
      'reminders',
      'memories',
      'memoryPhotos',
    ];
    const nextResources = {
      accommodations: [],
      checklists: [],
      checklistItems: [],
      packingItems: [],
      packingLists: [],
      transports: [],
      expenses: [],
      reminders: [],
      memories: [],
      memoryPhotos: [],
      errors: {},
    };

    results.forEach((result, index) => {
      const key = keys[index];
      if (result.status === 'fulfilled') {
        nextResources[key] = result.value;
      } else {
        console.error(`Could not load trip ${key}:`, result.reason);
        nextResources.errors[key] =
          result.reason instanceof Error
            ? result.reason.message
            : `Could not load ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}.`;
      }
    });

    setTripResources(nextResources);
    setIsLoadingResources(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadTripResources);
  }, [loadTripResources]);

  const reloadTripResources = useCallback(async () => {
    setIsLoadingResources(true);
    await loadTripResources();
  }, [loadTripResources]);

  const handleCreateDestination = async () => {
    if (
      !destinationForm.name.trim() ||
      !destinationForm.country.trim() ||
      !destinationForm.countryCode.trim()
    ) {
      return;
    }

    setIsSavingDestination(true);
    setDestinationFormError('');
    try {
      const newDestination = await createDestination({
        name: destinationForm.name.trim(),
        country: destinationForm.country.trim(),
        country_code: destinationForm.countryCode.trim().toUpperCase(),
        currency: destinationForm.currency.trim().toUpperCase() || null,
        description: destinationForm.description.trim() || null,
      });
      setDestinations((current) => [newDestination, ...current]);
      setFormData((current) => ({
        ...current,
        destinationId: String(newDestination.id),
        currency: newDestination.currency || current.currency,
        name: current.name || newDestination.name,
      }));
      setDestinationForm({
        name: '',
        country: '',
        countryCode: '',
        currency: '',
        description: '',
      });
      setIsCreatingDestination(false);
    } catch (error) {
      console.error('Could not create destination:', error);
      setDestinationFormError(
        error instanceof Error ? error.message : 'Could not create destination.',
      );
    } finally {
      setIsSavingDestination(false);
    }
  };

  useEffect(() => {
    const destination = location.state?.addDestination;
    let task = loadTask.current;

    if (!task || task.locationKey !== location.key) {
      task = {
        locationKey: location.key,
        promise: getTrips(50),
      };
      loadTask.current = task;
    }

    let isActive = true;
    task.promise
      .then((existingTrips) => {
        if (!isActive) return;

        setTrips(existingTrips);
        if (destination) {
          const selectedDestinationId =
            destination.kind === 'place'
              ? destination.destination_id
              : destination.id;
          setFormData((current) => ({
            ...current,
            destinationId: Number.isInteger(Number(selectedDestinationId))
              ? String(selectedDestinationId)
              : '',
            name: destination.title || destination.name || current.name,
            description:
              destination.description ||
              destination.desc ||
              current.description,
            imageUrl:
              destination.img ||
              destination.image ||
              destination.imageUrl ||
              current.imageUrl,
            currency: 'USD',
          }));
          setIsModalOpen(true);
        }
        setIsLoading(false);

        if (destination) {
          navigate(location.pathname, { replace: true, state: null });
        }
      })
      .catch((error) => {
        if (!isActive) return;
        console.error('Could not load trips:', error);
        setActionError(
          error instanceof Error ? error.message : 'Could not load trips.',
        );
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [location.key, location.pathname, location.state, navigate]);

  // Handle Create Trip Form Submission
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (
      !formData.name.trim() ||
      !formData.destinationId ||
      !formData.startDate ||
      !formData.endDate ||
      !formData.currency.trim()
    ) {
      return;
    }

    setIsSubmitting(true);
    setActionError('');
    try {
      const destination = destinations.find(
        (item) => String(item.id) === formData.destinationId,
      );
      const newTrip = await createTripFromStore({
        destination_id: Number(formData.destinationId),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        start_date: formData.startDate,
        end_date: formData.endDate,
        currency: formData.currency.trim().toUpperCase(),
        budget_amount:
          formData.budgetAmount === '' ? null : Number(formData.budgetAmount),
        data: {
          image: formData.imageUrl.trim() || destination?.image || null,
          location: [destination?.name, destination?.country]
            .filter(Boolean)
            .join(', '),
        },
      });

      setTrips((prev) => [newTrip, ...prev]);
      setIsModalOpen(false);
      setFormData(createEmptyTripForm());
    } catch (error) {
      console.error('Could not create trip:', error);
      setActionError(
        error instanceof Error ? error.message : 'Could not save this trip.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndTrip = async (trip, event) => {
    event.preventDefault();
    if (
      !window.confirm(
        `Complete "${trip.name}" and archive its spending summary?`,
      )
    ) {
      return;
    }
    setActionError('');
    try {
      const result = await endTrip(trip.id);
      setTrips((current) =>
        current.map((item) =>
          String(item.id) === String(trip.id) ? result.trip : item,
        ),
      );
    } catch (error) {
      console.error('Could not complete trip:', error);
      setActionError(
        error instanceof Error ? error.message : 'Could not complete this trip.',
      );
    }
  };

  // Handle Delete Trip
  const handleDelete = async (tripId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this trip?')) return;

    try {
      await deleteTrip(tripId);
      setTrips((prev) => prev.filter((trip) => trip.id !== tripId));
    } catch (error) {
      console.error(`Could not delete trip ${tripId}:`, error);
      setActionError(
        error instanceof Error ? error.message : 'Could not delete this trip.',
      );
    }
  };

  const today = new Date();
  const tripGroups = trips.reduce(
    (groups, trip) => {
      groups[getTripGroup(trip, today)].push(trip);
      return groups;
    },
    { upcoming: [], active: [], past: [], drafts: [] },
  );
  tripGroups.upcoming.sort(
    (left, right) =>
      (parseTripDate(left.start_date)?.getTime() ?? Infinity) -
      (parseTripDate(right.start_date)?.getTime() ?? Infinity),
  );
  const preferredTrips = activeFilter === 'all'
    ? [...tripGroups.active, ...tripGroups.upcoming]
    : activeFilter === 'active'
      ? tripGroups.active
      : activeFilter === 'upcoming'
        ? tripGroups.upcoming
        : activeFilter === 'past'
          ? tripGroups.past
          : tripGroups.drafts;
  const featuredTrip = preferredTrips[0] || null;
  const supportingTrips =
    activeFilter === 'past' || activeFilter === 'drafts'
      ? preferredTrips
      : preferredTrips.slice(1);
  const archiveTrips = activeFilter === 'all' ? tripGroups.past.slice(0, 2) : [];
  const destinationById = new Map(
    destinations.map((destination) => [String(destination.id), destination]),
  );
  const visitedCountries = new Set(
    trips
      .map((trip) => destinationById.get(String(trip.destination_id))?.country)
      .filter(Boolean),
  );
  const deadlineItems = tripResources.checklistItems
    .filter((item) => item.due_date && !item.is_completed)
    .map((item) => ({
      ...item,
      trip: trips.find((trip) => tripResources.checklists.some(
        (checklist) =>
          String(checklist.id) === String(item.checklist_id) &&
          String(checklist.trip_id) === String(trip.id),
      )),
    }))
    .filter((item) => item.trip)
    .sort(
      (left, right) =>
        (parseTripDate(left.due_date)?.getTime() ?? Infinity) -
        (parseTripDate(right.due_date)?.getTime() ?? Infinity),
    )
    .slice(0, 2);
  const prepRecordCount = (trip) => {
    const tripMatches = (record) => String(record.trip_id) === String(trip.id);
    return [
      tripResources.accommodations.some(tripMatches),
      tripResources.transports.some(tripMatches),
      tripResources.checklists.some(tripMatches),
      tripResources.packingLists.some(tripMatches),
    ].filter(Boolean).length;
  };
  const getTripSpend = (trip) => {
    const expenses = tripResources.expenses.filter(
      (expense) => String(expense.trip_id) === String(trip.id),
    );
    const sameCurrency = expenses.filter(
      (expense) =>
        String(expense.currency || '').toUpperCase() ===
        String(trip.currency || '').toUpperCase(),
    );
    return {
      amount: sameCurrency.reduce(
        (total, expense) => total + Number(expense.amount || 0),
        0,
      ),
      hasExpenses: expenses.length > 0,
      hasOtherCurrencies: sameCurrency.length !== expenses.length,
    };
  };
  const getTripMemories = (trip) => {
    const memories = tripResources.memories.filter(
      (memory) => String(memory.trip_id) === String(trip.id),
    );
    const memoryIds = new Set(memories.map((memory) => String(memory.id)));
    const photos = tripResources.memoryPhotos.filter((photo) =>
      memoryIds.has(String(photo.memory_id)),
    );
    return { memories, photos };
  };
  const filteredTripCount = {
    all: trips.length,
    upcoming: tripGroups.upcoming.length,
    active: tripGroups.active.length,
    past: tripGroups.past.length,
    drafts: tripGroups.drafts.length,
  }[activeFilter];

  return (
    <div className="min-h-full bg-slate-50 p-4 text-slate-800 sm:p-7">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="relative flex flex-col gap-5 overflow-hidden rounded-3xl bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div aria-hidden="true" className="absolute -bottom-10 -right-10 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" />
          <div className="relative z-10">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-teal-200">
              <span className="mr-1 text-emerald-300">•</span> Active command center
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
              My Trips
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-teal-100/80">
              Manage, track, and organize your upcoming, active, and past adventures.
            </p>
          </div>
          <div className="relative z-10 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/ai')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800 transition hover:bg-indigo-100"
            >
              <Sparkles size={16} />
              Open AI trip assistant
              <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-indigo-600">
                AI
              </span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-900"
              type="button"
            >
              <Plus size={17} /> Create New Trip
            </button>
          </div>
        </header>

        {actionError && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {actionError}
          </p>
        )}

        {Object.entries(tripResources.errors).length > 0 && (
          <div
            className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"
            role="status"
          >
            <p className="font-semibold">
              Some trip details could not be loaded:
            </p>
            {Object.entries(tripResources.errors).map(([key, message]) => (
              <p key={key}>{message}</p>
            ))}
            <button
              className="mt-1 font-semibold underline underline-offset-2"
              onClick={() => void reloadTripResources()}
              type="button"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.9fr)]">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="h-64 animate-pulse rounded-3xl bg-slate-200/70"
              />
            ))}
          </div>
        ) : trips.length > 0 ? (
          <>
            <nav className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2 overflow-x-auto">
                {[
                  ['all', 'All trips'],
                  ['upcoming', 'Upcoming'],
                  ['active', 'Active / In progress'],
                  ['past', 'Past memories'],
                  ['drafts', 'Drafts'],
                ].map(([filter, label]) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
                      activeFilter === filter
                        ? 'bg-teal-800 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      activeFilter === filter ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {filter === 'all' ? trips.length : tripGroups[filter].length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 self-end rounded-xl bg-slate-100 p-1 sm:self-auto">
                <button
                  aria-label="Grid view"
                  aria-pressed={isGridView}
                  className={`rounded-lg p-2 ${isGridView ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'}`}
                  onClick={() => setIsGridView(true)}
                  type="button"
                >
                  <Grid2X2 size={16} />
                </button>
                <button
                  aria-label="List view"
                  aria-pressed={!isGridView}
                  className={`rounded-lg p-2 ${!isGridView ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'}`}
                  onClick={() => setIsGridView(false)}
                  type="button"
                >
                  <LayoutList size={16} />
                </button>
              </div>
            </nav>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.85fr)_minmax(280px,0.9fr)]">
              <main className="min-w-0 space-y-6">
                {featuredTrip && activeFilter !== 'past' && activeFilter !== 'drafts' && (
                  (() => {
                    const trip = featuredTrip;
                    const tripData = trip.data && typeof trip.data === 'object' ? trip.data : {};
                    const destination = destinationById.get(String(trip.destination_id));
                    const title = trip.name || 'Untitled trip';
                    const locationText = tripData.location ||
                      [destination?.name, destination?.country].filter(Boolean).join(', ') ||
                      'Destination not set';
                    const image =
                      (trip.cover_image && resolveApiUrl(trip.cover_image)) ||
                      tripData.image ||
                      destination?.image ||
                      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80';
                    const prep = prepRecordCount(trip);
                    const prepPercent = Math.round((prep / 4) * 100);
                    const tripTransport = tripResources.transports.find(
                      (item) => String(item.trip_id) === String(trip.id),
                    );
                    const tripStay = tripResources.accommodations.find(
                      (item) => String(item.trip_id) === String(trip.id),
                    );
                    const tripSpend = getTripSpend(trip);
                    const budgetAmount = Number(trip.budget_amount);
                    const spendProgress = Number.isFinite(budgetAmount) && budgetAmount > 0
                      ? Math.min(100, (tripSpend.amount / budgetAmount) * 100)
                      : 0;
                    const startDate = parseTripDate(trip.start_date);
                    const daysUntil = startDate
                      ? Math.ceil((startDate.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000)
                      : null;
                    return (
                      <article className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm" id={`trip-${trip.id}`} key={trip.id}>
                        <div className="relative min-h-72 overflow-hidden bg-slate-800 sm:min-h-[330px]">
                          <img
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={(event) => { event.currentTarget.style.display = 'none'; }}
                            src={image}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/25 to-slate-950/10" />
                          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4 sm:p-6">
                            <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white backdrop-blur">
                              {getTripGroup(trip, today) === 'active' ? 'Active trip' : String(trip.status || 'Planning')}
                            </span>
                            <div className="flex items-center gap-2">
                              {daysUntil != null && daysUntil > 0 && (
                                <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-800">
                                  Starts in {daysUntil} {daysUntil === 1 ? 'day' : 'days'}
                                </span>
                              )}
                              <button
                                aria-label={`Delete ${title}`}
                                className="grid h-9 w-9 place-items-center rounded-full bg-slate-950/35 text-white backdrop-blur hover:bg-rose-600"
                                onClick={(event) => handleDelete(trip.id, event)}
                                title="Delete trip"
                                type="button"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                            <p className="flex items-center gap-1.5 text-xs font-bold text-teal-100">
                              <MapPin size={14} /> {locationText}
                            </p>
                            <h2 className="mt-2 max-w-2xl text-2xl font-black text-white sm:text-3xl">{title}</h2>
                            <p className="mt-2 flex items-center gap-2 text-sm font-medium text-white/85">
                              <CalendarDays size={15} /> {formatTripDateRange(trip.start_date, trip.end_date)}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-5 p-4 sm:p-6">
                          <div className="flex flex-col gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs font-bold uppercase tracking-wide text-sky-800">Next confirmed milestone</p>
                            <p className="text-sm font-semibold text-slate-800">
                              {tripTransport
                                ? `${tripTransport.type || 'Transport'} · ${tripTransport.from_location || locationText} → ${tripTransport.to_location || locationText}`
                                : tripStay
                                  ? `${tripStay.name} · check-in ${new Date(tripStay.check_in).toLocaleDateString()}`
                                  : 'Add a stay, transport, or checklist item to track milestones.'}
                            </p>
                          </div>

                          <section>
                            <div className="mb-2 flex items-center justify-between">
                              <h3 className="text-sm font-bold text-slate-900">Trip preparation</h3>
                              <span className="text-xs font-extrabold text-teal-800">{prepPercent}% set up</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${prepPercent}%` }} />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {[
                                ['Stay', Boolean(tripStay)],
                                ['Transport', Boolean(tripTransport)],
                                ['Checklist', tripResources.checklists.some((item) => String(item.trip_id) === String(trip.id))],
                                ['Packing list', tripResources.packingLists.some((item) => String(item.trip_id) === String(trip.id))],
                              ].map(([label, done]) => (
                                <span key={label} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${done ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                                  {done ? <Check size={12} /> : <Clock3 size={12} />} {label}
                                </span>
                              ))}
                            </div>
                          </section>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                              <div className="flex items-center justify-between gap-2">
                                <p className="flex items-center gap-2 text-xs font-bold text-slate-600"><Wallet size={15} className="text-teal-700" /> Budget ledger</p>
                                {trip.budget_amount != null && <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${tripSpend.amount > budgetAmount ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{tripSpend.amount > budgetAmount ? 'Over plan' : 'On track'}</span>}
                              </div>
                              <p className="mt-3 text-lg font-black text-slate-900">
                                {tripSpend.hasExpenses
                                  ? `${formatTripBudget(tripSpend.amount, trip.currency)} spent`
                                  : 'No expenses logged'}
                                {trip.budget_amount != null && <span className="font-semibold text-slate-500"> of {formatTripBudget(trip.budget_amount, trip.currency)}</span>}
                              </p>
                              {trip.budget_amount != null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${tripSpend.amount > budgetAmount ? 'bg-rose-500' : 'bg-teal-600'}`} style={{ width: `${spendProgress}%` }} /></div>}
                              <p className="mt-1 text-[11px] text-slate-500">{tripSpend.hasOtherCurrencies ? 'Only expenses in the trip currency are included.' : tripSpend.hasExpenses ? 'Based on expenses recorded for this trip.' : 'Add an expense to track your actual spend.'}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                              <p className="flex items-center gap-2 text-xs font-bold text-slate-600"><Compass size={15} className="text-teal-700" /> Trip details</p>
                              <p className="mt-3 text-lg font-black text-slate-900">
                                {tripResources.accommodations.filter((item) => String(item.trip_id) === String(trip.id)).length} stays
                                <span className="mx-2 text-slate-300">·</span>
                                {tripResources.transports.filter((item) => String(item.trip_id) === String(trip.id)).length} rides
                              </p>
                              <p className="mt-1 text-[11px] text-slate-500">Booking and planning records linked to this trip.</p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <a className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-3 text-sm font-bold text-white hover:bg-teal-900" href={`#trip-details-${trip.id}`}>
                              Open Trip Dashboard <ArrowRight size={16} />
                            </a>
                            <Link className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50" to="/budget">
                              <Wallet size={15} /> Budget
                            </Link>
                            <Link className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50" to="/explore">
                              <Compass size={15} /> Places
                            </Link>
                            {getTripGroup(trip, today) === 'active' && (
                              <button
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50"
                                onClick={(event) => void handleEndTrip(trip, event)}
                                type="button"
                              >
                                <Check size={15} /> Complete trip
                              </button>
                            )}
                          </div>
                          <div id={`trip-details-${trip.id}`}>
                            <TripPlanningPanel
                              key={trip.id}
                              onReload={reloadTripResources}
                              resources={tripResources}
                              trip={trip}
                            />
                            {isLoadingResources && <p className="mt-2 text-xs text-slate-400">Loading trip details…</p>}
                          </div>
                        </div>
                      </article>
                    );
                  })()
                )}

                {supportingTrips.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-black text-slate-900">
                          {activeFilter === 'past' ? 'Past memories & expeditions' : activeFilter === 'drafts' ? 'Draft trips' : 'More trips in your plans'}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">Your saved trips, organized by their travel dates.</p>
                      </div>
                      {activeFilter === 'past' ? (
                        <Link className="text-xs font-bold text-teal-800 hover:text-teal-950" to="/memories">View all memories <ArrowRight className="ml-1 inline" size={13} /></Link>
                      ) : (
                        <span className="text-xs font-bold text-slate-500">{filteredTripCount} trips</span>
                      )}
                    </div>
                    <div className={isGridView ? 'grid gap-4 sm:grid-cols-2' : 'space-y-3'}>
                      {supportingTrips.map((trip) => {
                        const tripData = trip.data && typeof trip.data === 'object' ? trip.data : {};
                        const destination = destinationById.get(String(trip.destination_id));
                        const title = trip.name || 'Untitled trip';
                        const locationText = tripData.location ||
                          [destination?.name, destination?.country].filter(Boolean).join(', ') ||
                          'Destination not set';
                        const image =
                          (trip.cover_image && resolveApiUrl(trip.cover_image)) ||
                          tripData.image ||
                          destination?.image ||
                          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&auto=format&fit=crop&q=80';
                        const prep = prepRecordCount(trip);
                        const tripSpend = getTripSpend(trip);
                        const { memories, photos } = getTripMemories(trip);
                        const archivePhoto = photos[0]?.image_path;
                        const archiveImage = archivePhoto
                          ? resolveApiUrl(archivePhoto)
                          : image;
                        return (
                          <article className={`overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm ${isGridView ? '' : 'sm:flex'}`} id={`trip-${trip.id}`} key={trip.id}>
                            <div className={`relative h-40 bg-slate-200 ${isGridView ? '' : 'sm:h-auto sm:w-52 sm:shrink-0'}`}>
                              <img alt="" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} src={activeFilter === 'past' ? archiveImage : image} />
                              <span className="absolute left-3 top-3 rounded-full bg-slate-950/65 px-2.5 py-1 text-[10px] font-bold uppercase text-white backdrop-blur">{String(trip.status || getTripGroup(trip, today))}</span>
                              {activeFilter === 'past' && photos.length > 0 && <span className="absolute bottom-3 left-3 rounded-full bg-slate-950/65 px-2.5 py-1 text-[10px] font-bold text-white">📷 {photos.length} {photos.length === 1 ? 'photo' : 'photos'}</span>}
                            </div>
                            <div className="min-w-0 flex-1 p-4">
                              <p className="flex items-center gap-1 text-[11px] font-semibold text-teal-800"><MapPin size={12} /> {locationText}</p>
                              <h3 className="mt-1 text-base font-extrabold text-slate-900">{title}</h3>
                              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays size={13} /> {formatTripDateRange(trip.start_date, trip.end_date)}</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700">{prep * 25}% prepared</span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{formatTripBudget(trip.budget_amount, trip.currency)}</span>
                                {activeFilter === 'past' && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{memories.length} {memories.length === 1 ? 'memory' : 'memories'}</span>}
                              </div>
                              {activeFilter === 'past' && <p className="mt-3 text-xs font-bold text-slate-700">{tripSpend.hasExpenses ? `${formatTripBudget(tripSpend.amount, trip.currency)} recorded spend` : 'No expenses recorded'}</p>}
                              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                                {activeFilter === 'past'
                                  ? <Link className="text-xs font-bold text-teal-800 hover:text-teal-950" to="/memories">View memories ({memories.length}) <ArrowRight className="ml-1 inline" size={13} /></Link>
                                  : <a className="text-xs font-bold text-teal-800 hover:text-teal-950" href={`#trip-details-${trip.id}`}>Manage planning <ArrowRight className="ml-1 inline" size={13} /></a>}
                                {activeFilter === 'past'
                                  ? <button aria-label={`Plan another ${title}`} className="rounded-lg p-2 text-slate-500 hover:bg-teal-50 hover:text-teal-800" onClick={() => { setFormData({ ...createEmptyTripForm(), destinationId: String(trip.destination_id), name: `${title} (copy)`, currency: trip.currency || 'USD', budgetAmount: trip.budget_amount ?? '', imageUrl: tripData.image || '' }); setIsModalOpen(true); }} title="Plan this trip again" type="button"><Plus size={15} /></button>
                                  : <button aria-label={`Delete ${title}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700" onClick={(event) => handleDelete(trip.id, event)} title="Delete trip" type="button"><Trash2 size={15} /></button>}
                              </div>
                              {activeFilter !== 'past' && <div className="mt-3" id={`trip-details-${trip.id}`}>
                                <TripPlanningPanel key={trip.id} onReload={reloadTripResources} resources={tripResources} trip={trip} />
                              </div>}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}

                {archiveTrips.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-black text-slate-900">Past memories & expeditions</h2>
                        <p className="mt-1 text-xs text-slate-500">A look back at completed trips and saved moments.</p>
                      </div>
                      <Link className="text-xs font-bold text-teal-800 hover:text-teal-950" to="/memories">View all archive ({tripGroups.past.length}) <ArrowRight className="ml-1 inline" size={13} /></Link>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {archiveTrips.map((trip) => {
                        const { memories, photos } = getTripMemories(trip);
                        const tripData = trip.data && typeof trip.data === 'object' ? trip.data : {};
                        const destination = destinationById.get(String(trip.destination_id));
                        const locationText = tripData.location || [destination?.name, destination?.country].filter(Boolean).join(', ');
                        const firstPhoto = photos[0]?.image_path;
                        const archiveImage = firstPhoto ? resolveApiUrl(firstPhoto) : (tripData.image || destination?.image || '');
                        return (
                          <article className="flex overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm" key={trip.id}>
                            <div className="relative w-28 shrink-0 bg-slate-100 sm:w-36">
                              {archiveImage && <img alt="" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} src={archiveImage} />}
                              {photos.length > 0 && <span className="absolute bottom-2 left-2 rounded-full bg-slate-950/70 px-2 py-1 text-[9px] font-bold text-white">📷 {photos.length}</span>}
                            </div>
                            <div className="min-w-0 flex-1 p-3">
                              <p className="truncate text-[10px] font-semibold text-teal-800">{locationText || 'Past trip'}</p>
                              <h3 className="mt-1 truncate text-sm font-extrabold text-slate-900">{trip.name}</h3>
                              <p className="mt-1 text-[10px] text-slate-500">{memories.length} saved {memories.length === 1 ? 'memory' : 'memories'}</p>
                              <Link className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-teal-800" to="/memories">View memories <ArrowRight size={12} /></Link>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}

                {preferredTrips.length === 0 && archiveTrips.length === 0 && (
                  <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-800"><Compass size={24} /></div>
                    <h2 className="mt-4 text-lg font-black text-slate-900">No {activeFilter === 'all' ? '' : activeFilter} trips here yet</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Create a trip to start organizing dates, bookings, checklists, and your travel budget.</p>
                    <button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-sm font-bold text-white hover:bg-teal-900" onClick={() => setIsModalOpen(true)} type="button"><Plus size={16} /> Create New Trip</button>
                  </section>
                )}
              </main>

              <aside className="space-y-4">
                <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black text-slate-900">Travel log & stats</h2>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-extrabold tracking-wide text-slate-500">YEAR {today.getFullYear()}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      [trips.length, 'Trips built'],
                      [visitedCountries.size, 'Countries'],
                      [tripResources.accommodations.length + tripResources.transports.length, 'Bookings'],
                    ].map(([value, label]) => (
                      <div className="rounded-xl bg-slate-50 p-3" key={label}>
                        <p className="text-xl font-black text-slate-900">{value}</p>
                        <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-3 rounded-2xl bg-teal-50 p-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-4 border-teal-200 text-teal-800"><Compass size={18} /></span>
                    <div><p className="text-xs font-bold text-teal-900">{trips.length} saved {trips.length === 1 ? 'adventure' : 'adventures'}</p><p className="mt-1 text-[10px] text-teal-800">Distance tracking is not connected yet.</p></div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-black text-slate-900">Upcoming reminders</h2>
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700">{deadlineItems.length} due</span>
                  </div>
                  {deadlineItems.length ? (
                    <div className="mt-4 space-y-3">
                      {deadlineItems.map((item) => (
                        <a className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3 transition hover:bg-slate-50" href={`#trip-details-${item.trip.id}`} key={item.id}>
                          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700"><AlertTriangle size={15} /></span>
                          <span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-800">{item.title}</span><span className="mt-1 block text-[10px] text-slate-500">{item.trip.name} · due {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parseTripDate(item.due_date))}</span></span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">No open checklist deadlines are recorded. Add due dates to checklist items to see reminders here.</p>
                  )}
                </section>

                <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-black text-slate-900">Next destination</h2>
                  {tripGroups.upcoming[0] ? (
                    (() => {
                      const nextTrip = tripGroups.upcoming[0];
                      const destination = destinationById.get(String(nextTrip.destination_id));
                      const locationText = nextTrip.data?.location ||
                        [destination?.name, destination?.country].filter(Boolean).join(', ');
                      return (
                        <div className="mt-4 rounded-2xl bg-gradient-to-br from-teal-900 to-slate-900 p-4 text-white">
                          <p className="flex items-center gap-2 text-xs font-bold"><MapPin size={14} /> {locationText || nextTrip.name}</p>
                          <p className="mt-2 text-[11px] text-teal-100">{formatTripDateRange(nextTrip.start_date, nextTrip.end_date)}</p>
                          {locationText && <a className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationText)}`} rel="noreferrer" target="_blank">Open in maps <ArrowRight size={13} /></a>}
                        </div>
                      );
                    })()
                  ) : (
                    <p className="mt-3 text-xs leading-5 text-slate-500">Create an upcoming trip to see its destination and travel dates here.</p>
                  )}
                </section>

                <section className="rounded-3xl border border-sky-100 bg-sky-50 p-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-teal-800" size={17} />
                    <h2 className="text-sm font-black text-slate-900">Instant action dock</h2>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-800 px-3 py-3 text-xs font-bold text-white hover:bg-teal-900" to="/explore"><MapPin size={14} /> Pin a place</Link>
                    <Link className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-white px-3 py-3 text-xs font-bold text-teal-900 hover:bg-teal-50" to="/budget"><Plus size={14} /> Add expense</Link>
                  </div>
                </section>
              </aside>
            </div>
          </>) : (
          <section className="rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-teal-50 text-teal-800"><Plane size={28} /></div>
            <h2 className="mt-4 text-xl font-black">Your next trip starts here</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              You do not have any trips planned yet. Explore a destination or create a trip to start organizing your travel.
            </p>
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-900"
                to="/explore"
              >
                <Compass size={16} /> Explore destinations
              </Link>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                type="button"
              >
                <Plus size={16} /> Create New Trip
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Modal: Create Trip */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Plan a New Trip</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Destination
                </label>
                <select
                  required
                  value={formData.destinationId}
                  onChange={(event) => {
                    const selected = destinations.find(
                      (item) => String(item.id) === event.target.value,
                    );
                    setFormData((current) => ({
                      ...current,
                      destinationId: event.target.value,
                      currency: 'USD',
                      name: current.name || selected?.name || '',
                    }));
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  disabled={isLoadingDestinations || destinations.length === 0}
                >
                  <option value="">
                    {isLoadingDestinations
                      ? 'Loading destinations…'
                      : 'Choose a destination'}
                  </option>
                  {destinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {[destination.name, destination.country].filter(Boolean).join(', ')}
                    </option>
                  ))}
                </select>
                {destinationError && (
                  <p className="mt-1 text-xs text-rose-600" role="alert">
                    {destinationError}
                  </p>
                )}
                {!isLoadingDestinations &&
                  !destinationError &&
                  destinations.length === 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      The backend has no destinations yet. Add a destination before planning a trip.
                    </p>
                  )}
                {!isCreatingDestination && (
                  <button
                    className="mt-2 text-xs font-semibold text-teal-700 underline underline-offset-2"
                    onClick={() => {
                      setDestinationFormError('');
                      setIsCreatingDestination(true);
                    }}
                    type="button"
                  >
                    Add a destination
                  </button>
                )}
              </div>

              {isCreatingDestination && (
                <section className="space-y-3 rounded-xl border border-teal-100 bg-teal-50/60 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-800">
                      Create a destination
                    </h4>
                    <button
                      className="text-xs font-semibold text-slate-500"
                      onClick={() => setIsCreatingDestination(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                  {[
                    ['name', 'Destination name', true],
                    ['country', 'Country', true],
                    ['countryCode', 'Country code', true],
                    ['currency', 'Currency (optional)', false],
                  ].map(([key, label, required]) => (
                    <label
                      className="block text-xs font-semibold text-slate-700"
                      key={key}
                    >
                      {label}
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                        maxLength={key === 'countryCode' ? 10 : 255}
                        onChange={(event) =>
                          setDestinationForm((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        required={required}
                        value={destinationForm[key]}
                      />
                    </label>
                  ))}
                  <label className="block text-xs font-semibold text-slate-700">
                    Description (optional)
                    <textarea
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      onChange={(event) =>
                        setDestinationForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      rows={2}
                      value={destinationForm.description}
                    />
                  </label>
                  {destinationFormError && (
                    <p className="text-xs text-rose-600" role="alert">
                      {destinationFormError}
                    </p>
                  )}
                  <button
                    className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    disabled={
                      isSavingDestination ||
                      !destinationForm.name.trim() ||
                      !destinationForm.country.trim() ||
                      !destinationForm.countryCode.trim()
                    }
                    onClick={() => void handleCreateDestination()}
                    type="button"
                  >
                    {isSavingDestination ? 'Saving…' : 'Save destination'}
                  </button>
                </section>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Trip Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Siem Reap Getaway"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Notes on itinerary, sights, or goals..."
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Cover Image URL
                </label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  End Date
                </label>
                <input
                  type="date"
                  required
                  min={formData.startDate}
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Currency
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={10}
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  placeholder="Choose a destination or enter a currency code"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm uppercase outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Total Trip Budget
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.budgetAmount}
                  onChange={(e) => setFormData({ ...formData, budgetAmount: e.target.value })}
                  placeholder="Optional"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isLoadingDestinations || destinations.length === 0}
                  className="rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-teal-700/20 hover:bg-teal-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Trip;