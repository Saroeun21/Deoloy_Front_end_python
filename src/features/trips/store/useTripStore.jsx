import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import accommodationApi from "../../../services/api/accommodation_api.js";
import budgetApi from "../../../services/api/budgetapi.js";
import budgetCategoryApi from "../../../services/api/budget_category_api.js";
import expenseApi from "../../../services/api/expense_api.js";
import itineraryDayApi from "../../../services/api/itinerary_day_api.js";
import itineraryItemApi from "../../../services/api/itinerary_item_api.js";
import memoryApi from "../../../services/api/memory_api.js";
import placeApi from "../../../services/api/placeapi.js";
import reminderApi from "../../../services/api/reminderapi.js";
import savedPlaceApi from "../../../services/api/saved_api.js";
import savedItemApi from "../../../services/api/savedItemApi.js";
import transportApi from "../../../services/api/transport_api.js";
import tripApi from "../../../services/api/tripapi.js";
import tripWalletApi from "../../../services/api/trip_wallet_api.js";
import { useAuth } from "../../../app/providers/authContext.js";

const TripStoreContext = createContext(null);

function normalizeList(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${label} API to return a list.`);
  }
  return value;
}

function getTripRecord(trips, tripId) {
  const trip = trips.find((item) => String(item.id) === String(tripId));
  if (!trip) throw new Error("Select a valid trip before continuing.");
  return trip;
}

function moneySpent(expenses, currency) {
  return expenses.reduce(
    (total, item) =>
      String(item.currency || currency).toUpperCase() ===
      String(currency || "").toUpperCase()
        ? total + Number(item.amount || 0)
        : total,
    0,
  );
}

function asDateTime(value) {
  if (!value) {
    throw new Error("A valid date and time is required.");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Provide a valid date and time.");
  }
  return date.toISOString();
}

function dateForTripDay(startDate, dayNumber) {
  const [year, month, day] = startDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + dayNumber - 1);
  return date.toISOString().slice(0, 10);
}

export function TripStoreProvider({ children }) {
  const { accessToken } = useAuth();
  const [trips, setTrips] = useState([]);
  const [activeTripId, setActiveTripId] = useState("");
  const [explorePlaces, setExplorePlaces] = useState([]);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [itineraryDayRecords, setItineraryDayRecords] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [pastMemories, setPastMemories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeTrip = trips.find(
    (trip) => String(trip.id) === String(activeTripId),
  ) || null;
  const activeBudgetRecord = budgets.find(
    (item) => String(item.trip_id) === String(activeTripId),
  );
  const activeCategories = useMemo(
    () => categories.filter(
      (item) => String(item.budget_id) === String(activeBudgetRecord?.id),
    ),
    [activeBudgetRecord?.id, categories],
  );
  const activeExpenses = useMemo(
    () => expenses.filter(
      (item) => String(item.trip_id) === String(activeTripId),
    ),
    [activeTripId, expenses],
  );
  const activeItinerary = useMemo(
    () => itinerary.filter(
      (item) => String(item.trip_id) === String(activeTripId),
    ),
    [activeTripId, itinerary],
  );
  const activeCurrency =
    activeBudgetRecord?.currency || activeTrip?.currency || "USD";
  const budget = useMemo(
    () => ({
      totalBudget: Number(
        activeBudgetRecord?.total_budget ?? activeTrip?.budget_amount ?? 0,
      ),
      spent: moneySpent(activeExpenses, activeCurrency),
      categories: activeCategories,
    }),
    [activeBudgetRecord, activeCategories, activeCurrency, activeExpenses, activeTrip],
  );

  const load = useCallback(async () => {
    if (!accessToken) {
      setTrips([]);
      setActiveTripId("");
      setExplorePlaces([]);
      setSavedPlaces([]);
      setItinerary([]);
      setItineraryDayRecords([]);
      setExpenses([]);
      setBudgets([]);
      setCategories([]);
      setWallets([]);
      setBookings([]);
      setReminders([]);
      setPastMemories([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [
        tripData,
        savedPlaceData,
        savedItemData,
        placeData,
        dayData,
        itineraryItemData,
        expenseData,
        budgetData,
        categoryData,
        walletData,
        accommodationData,
        transportData,
        reminderData,
        memoryData,
      ] = await Promise.all([
        tripApi.list(),
        savedPlaceApi.list(),
        savedItemApi.list(),
        placeApi.list(),
        itineraryDayApi.list(),
        itineraryItemApi.list(),
        expenseApi.list(),
        budgetApi.list(),
        budgetCategoryApi.list(),
        tripWalletApi.list(),
        accommodationApi.list(),
        transportApi.list(),
        reminderApi.list(),
        memoryApi.list(),
      ]);
      const tripList = normalizeList(tripData, "trips");
      const placeList = normalizeList(placeData, "places");
      const days = normalizeList(dayData, "itinerary days");
      const savedIds = new Set(
        normalizeList(savedPlaceData, "saved places").map((item) =>
          String(item.place_id),
        ),
      );
      const savedCatalogItems = normalizeList(
        savedItemData,
        "saved catalog items",
      ).map((item) => ({ ...item, item_type: item.item_type }));
      setTrips(tripList);
      setExplorePlaces(placeList);
      setActiveTripId((current) =>
        tripList.some((item) => String(item.id) === String(current))
          ? String(current)
          : tripList[0]
            ? String(tripList[0].id)
            : "",
      );
      setSavedPlaces([
        ...placeList.filter((place) => savedIds.has(String(place.id))),
        ...savedCatalogItems,
      ]);
      setItinerary(
        normalizeList(itineraryItemData, "itinerary items").map((item) => {
          const day = days.find(
            (candidate) =>
              String(candidate.id) === String(item.itinerary_day_id),
          );
          return {
            ...item,
            trip_id: day?.trip_id,
            day: day?.day_number,
            date: day?.date,
          };
        }),
      );
      setItineraryDayRecords(days);
      setExpenses(normalizeList(expenseData, "expenses"));
      setBudgets(normalizeList(budgetData, "budgets"));
      setCategories(normalizeList(categoryData, "budget categories"));
      setWallets(normalizeList(walletData, "trip wallets"));
      setBookings([
        ...normalizeList(accommodationData, "accommodations").map((item) => ({
          ...item,
          kind: "stay",
        })),
        ...normalizeList(transportData, "transports").map((item) => ({
          ...item,
          kind: String(item.type || "").toLowerCase() === "flight"
            ? "flight"
            : "transport",
        })),
      ]);
      setReminders(normalizeList(reminderData, "reminders"));
      const completedTrips = tripList.filter(
        (trip) => String(trip.status).toLowerCase() === "completed",
      );
      const savedMemories = normalizeList(memoryData, "memories");
      setPastMemories([
        ...savedMemories.filter((memory) =>
          completedTrips.some(
            (trip) => String(trip.id) === String(memory.trip_id),
          ),
        ),
        ...completedTrips.map((trip) => {
          const tripExpenses = normalizeList(expenseData, "expenses").filter(
            (item) => String(item.trip_id) === String(trip.id),
          );
          return {
            id: `trip-archive-${trip.id}`,
            trip_id: trip.id,
            title: trip.name,
            memory_date: trip.end_date,
            analytics: {
              totalSpent: moneySpent(tripExpenses, trip.currency),
              currency: trip.currency || "USD",
              expenseCount: tripExpenses.length,
            },
            archived_trip: trip,
          };
        }),
      ]);
    } catch (loadError) {
      console.error("Could not load TripOS lifecycle data:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load trip data.",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const createTrip = useCallback(async (payload) => {
    const destinationId =
      payload.destination_id ??
      payload.destinationId ??
      payload.destinations?.[0]?.id;
    const startDate = payload.start_date ?? payload.dates?.start ?? payload.startDate;
    const endDate = payload.end_date ?? payload.dates?.end ?? payload.endDate;
    const title = payload.title ?? payload.name;
    if (!destinationId || !title || !startDate || !endDate) {
      throw new Error(
        "A trip needs a destination, title, start date, and end date.",
      );
    }

    const created = await tripApi.create({
      destination_id: Number(destinationId),
      name: title,
      description: payload.description ?? null,
      start_date: startDate,
      end_date: endDate,
      currency: payload.currency || "USD",
      budget_amount: payload.totalBudget ?? payload.budget_amount ?? null,
      status: "planning",
      data: {
        ...(payload.data || {}),
        destinations: payload.destinations || [],
        workflow_status: "ACTIVE",
      },
    });
    setTrips((current) => [created, ...current]);
    setActiveTripId(String(created.id));
    return { ...created, tripId: created.id, title: created.name };
  }, []);

  const savePlace = useCallback(async (place) => {
    if (place?.id == null) {
      throw new Error("Only a saved backend place can be added to the wishlist.");
    }
    const existing = savedPlaces.some(
      (item) => String(item.id) === String(place.id),
    );
    if (existing) return place;
    await savedPlaceApi.save(place.id);
    setSavedPlaces((current) => [...current, place]);
    return place;
  }, [savedPlaces]);

  const unsavePlace = useCallback(async (placeId) => {
    const record = savedPlaces.find(
      (item) => String(item.id) === String(placeId),
    );
    if (!record) return;
    const savedRecords = await savedPlaceApi.list();
    const persisted = savedRecords.find(
      (item) => String(item.place_id) === String(placeId),
    );
    if (persisted) await savedPlaceApi.remove(persisted.id);
    setSavedPlaces((current) =>
      current.filter((item) => String(item.id) !== String(placeId)),
    );
  }, [savedPlaces]);

  const addItineraryItem = useCallback(async (input) => {
    const trip = getTripRecord(trips, input.tripId ?? activeTripId);
    const dayNumber = Number(input.day ?? input.day_number ?? 1);
    if (!Number.isInteger(dayNumber) || dayNumber < 1) {
      throw new Error("The itinerary day must be a positive whole number.");
    }
    const title = String(input.title || input.name || "").trim();
    if (!title) {
      throw new Error("An itinerary item needs a title.");
    }
    const date = input.date || dateForTripDay(trip.start_date, dayNumber);
    let dayRecord = itineraryDayRecords.find(
      (day) =>
        String(day.trip_id) === String(trip.id) &&
        Number(day.day_number) === dayNumber,
    );
    if (!dayRecord) {
      dayRecord = await itineraryDayApi.create({
        trip_id: trip.id,
        day_number: dayNumber,
        date,
        title: input.dayTitle || null,
      });
      setItineraryDayRecords((current) => [...current, dayRecord]);
    }
    const cost = Number(input.cost ?? input.estimated_cost ?? 0);
    if (!Number.isFinite(cost) || cost < 0) {
      throw new Error("Itinerary cost must be a non-negative number.");
    }
    const item = await itineraryItemApi.create({
      itinerary_day_id: dayRecord.id,
      place_id: input.placeId ? Number(input.placeId) : null,
      title,
      description: input.description || null,
      start_time: input.time || input.start_time || null,
      end_time: input.end_time || null,
      estimated_cost: cost || null,
      type: input.type || "activity",
      status: "planned",
      order_index: itinerary.filter(
        (existing) => String(existing.itinerary_day_id) === String(dayRecord.id),
      ).length,
    });
    setItinerary((current) => [...current, { ...item, day: dayNumber, date }]);

    let pendingExpense = null;
    if (cost > 0) {
      pendingExpense = {
        id: `pending-itinerary-${item.id}`,
        trip_id: trip.id,
        description: item.title,
        amount: cost,
        currency: trip.currency || "USD",
        expense_date: date,
        status: "pending",
        source_itinerary_item_id: item.id,
      };
      setExpenses((current) => [...current, pendingExpense]);
      try {
        const budgetRecord = budgets.find(
          (candidate) => String(candidate.trip_id) === String(trip.id),
        );
        const category = categories.find(
          (candidate) =>
            String(candidate.budget_id) === String(budgetRecord?.id),
        );
        const wallet = wallets.find(
          (candidate) => String(candidate.trip_id) === String(trip.id),
        );
        if (!budgetRecord || !category || !wallet) {
          throw new Error(
            "The itinerary item was saved, but its expense is pending. Add a trip budget, category, and wallet to sync it to the ledger.",
          );
        }
        const expense = await expenseApi.create({
          trip_id: trip.id,
          budget_category_id: category.id,
          wallet_id: wallet.id,
          description: item.title,
          amount: cost,
          currency: trip.currency || "USD",
          expense_date: date,
          payment_method: "Trip wallet",
        });
        setExpenses((current) =>
          current.map((entry) =>
            entry.id === pendingExpense.id ? expense : entry,
          ),
        );
        pendingExpense = null;
      } catch (expenseError) {
        console.error("Itinerary item saved with pending expense:", expenseError);
        pendingExpense = {
          ...pendingExpense,
          sync_error:
            expenseError instanceof Error
              ? expenseError.message
              : "Could not sync expense.",
        };
        setExpenses((current) =>
          current.map((entry) =>
            entry.id === pendingExpense.id ? pendingExpense : entry,
          ),
        );
      }
    }
    return { item, pendingExpense };
  }, [
    activeTripId,
    budgets,
    categories,
    itinerary,
    trips,
    wallets,
    itineraryDayRecords,
  ]);

  const updateBudget = useCallback(async (payload) => {
    const trip = getTripRecord(trips, payload.tripId ?? activeTripId);
    const amount = Number(
      payload.totalBudget ?? payload.total_budget ?? payload.amount,
    );
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Budget must be a non-negative number.");
    }
    const existing = budgets.find(
      (item) => String(item.trip_id) === String(trip.id),
    );
    const saved = existing
      ? await budgetApi.update(existing.id, { total_budget: amount })
      : await budgetApi.create({
          trip_id: trip.id,
          total_budget: amount,
          currency: trip.currency || "USD",
        });
    setBudgets((current) =>
      existing
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [...current, saved],
    );
    return saved;
  }, [activeTripId, budgets, trips]);

  const addExpense = useCallback(async (input) => {
    const trip = getTripRecord(trips, input.tripId ?? activeTripId);
    const budgetRecord = budgets.find(
      (item) => String(item.trip_id) === String(trip.id),
    );
    const category =
      input.budget_category_id
        ? categories.find(
            (item) =>
              String(item.id) === String(input.budget_category_id) &&
              String(item.budget_id) === String(budgetRecord?.id),
          )
        : categories.find(
            (item) => String(item.budget_id) === String(budgetRecord?.id),
          );
    const wallet = wallets.find(
      (item) => String(item.trip_id) === String(trip.id),
    );
    const amount = Number(input.amount);
    if (!input.description || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("An expense needs a description and a positive amount.");
    }
    const pending = {
      id: `pending-${Date.now()}`,
      trip_id: trip.id,
      description: input.description,
      amount,
      currency: input.currency || trip.currency || "USD",
      expense_date: input.expense_date || new Date().toISOString().slice(0, 10),
      status: "pending",
    };
    setExpenses((current) => [...current, pending]);
    if (!budgetRecord || !category || !wallet) {
      const missing = [
        !budgetRecord && "trip budget",
        !category && "budget category",
        !wallet && "trip wallet",
      ].filter(Boolean).join(", ");
      const syncError = `Expense is pending; configure ${missing} to save it to the backend ledger.`;
      setExpenses((current) =>
        current.map((item) =>
          item.id === pending.id ? { ...item, sync_error: syncError } : item,
        ),
      );
      return { ...pending, sync_error: syncError };
    }
    try {
      const saved = await expenseApi.create({
        trip_id: trip.id,
        budget_category_id: category.id,
        wallet_id: wallet.id,
        description: input.description,
        amount,
        currency: input.currency || trip.currency || "USD",
        expense_date: input.expense_date || new Date().toISOString().slice(0, 10),
        payment_method: input.payment_method || "Trip wallet",
      });
      setExpenses((current) =>
        current.map((item) => (item.id === pending.id ? saved : item)),
      );
      return saved;
    } catch (saveError) {
      setExpenses((current) =>
        current.map((item) =>
          item.id === pending.id
            ? {
                ...item,
                sync_error:
                  saveError instanceof Error
                    ? saveError.message
                    : "Could not save expense.",
              }
            : item,
        ),
      );
      throw saveError;
    }
  }, [activeTripId, budgets, categories, trips, wallets]);

  const addBooking = useCallback(async (booking) => {
    const trip = getTripRecord(trips, booking.tripId ?? activeTripId);
    const kind = String(booking.kind || booking.type || "stay").toLowerCase();
    let saved;
    if (["stay", "hotel", "accommodation", "lodging"].includes(kind)) {
      saved = await accommodationApi.create({
        trip_id: trip.id,
        name: booking.name || booking.title,
        address: booking.address || null,
        check_in: asDateTime(booking.check_in || booking.checkIn),
        check_out: asDateTime(booking.check_out || booking.checkOut),
        room_type: booking.room_type || booking.roomType || null,
        confirmation_number:
          booking.confirmation_number || booking.confirmationNumber || null,
        cost: booking.cost == null ? null : Number(booking.cost),
        notes: booking.notes || null,
      });
      saved = { ...saved, kind: "stay" };
    } else {
      const transportType = kind === "flight" ? "flight" : kind;
      saved = await transportApi.create({
        trip_id: trip.id,
        type: transportType,
        provider: booking.provider || booking.airline || null,
        from_location: booking.from_location || booking.from || "Unknown",
        to_location: booking.to_location || booking.to || "Unknown",
        departure_time: asDateTime(
          booking.departure_time || booking.departureTime,
        ),
        arrival_time: asDateTime(booking.arrival_time || booking.arrivalTime),
        booking_number:
          booking.booking_number || booking.confirmation_number || null,
        seat: booking.seat || null,
        cost: booking.cost == null ? null : Number(booking.cost),
        notes: booking.notes || null,
      });
      saved = { ...saved, kind: transportType === "flight" ? "flight" : "transport" };
    }
    setBookings((current) => [...current, saved]);
    return saved;
  }, [activeTripId, trips]);

  const addReminder = useCallback(async (reminder) => {
    const trip = getTripRecord(trips, reminder.tripId ?? activeTripId);
    const saved = await reminderApi.create({
      trip_id: trip.id,
      title: reminder.title,
      description: reminder.description || null,
      due_date: asDateTime(reminder.due_date || reminder.dueDate),
      type: reminder.type || "custom",
      status: "pending",
    });
    setReminders((current) => [...current, saved]);
    return saved;
  }, [activeTripId, trips]);

  const endTrip = useCallback(async (tripId) => {
    const trip = getTripRecord(trips, tripId);
    const updated = await tripApi.update(trip.id, { status: "completed" });
    const tripExpenses = expenses.filter(
      (item) => String(item.trip_id) === String(trip.id),
    );
    const analytics = {
      totalSpent: moneySpent(tripExpenses, trip.currency),
      currency: trip.currency || "USD",
      expenseCount: tripExpenses.length,
      completedAt: new Date().toISOString(),
    };
    setTrips((current) =>
      current.map((item) => (String(item.id) === String(trip.id) ? updated : item)),
    );
    setPastMemories((current) => [
      {
        id: `trip-archive-${trip.id}`,
        trip_id: trip.id,
        title: trip.name,
        memory_date: trip.end_date,
        location: trip.destination?.name || null,
        analytics,
        archived_trip: updated,
      },
      ...current.filter(
        (memory) => String(memory.trip_id) !== String(trip.id),
      ),
    ]);
    return { trip: updated, analytics };
  }, [expenses, trips]);

  const executeAssistantAction = useCallback(async (name, args = {}) => {
    if (name === "add_itinerary_item") return addItineraryItem(args);
    if (name === "update_budget") return updateBudget(args);
    if (name === "add_expense") return addExpense(args);
    if (name === "add_reminder") return addReminder(args);
    if (name === "end_trip") return endTrip(args.tripId ?? activeTripId);
    throw new Error(`Unsupported assistant action: ${name}`);
  }, [
    activeTripId,
    addExpense,
    addItineraryItem,
    addReminder,
    endTrip,
    updateBudget,
  ]);

  const value = useMemo(() => ({
    trips,
    activeTrip,
    activeTripId,
    setActiveTripId,
    explorePlaces,
    setExplorePlaces,
    savedPlaces,
    savePlace,
    unsavePlace,
    itinerary: activeItinerary,
    budget,
    expenses: activeExpenses,
    allExpenses: expenses,
    bookings: bookings.filter(
      (booking) => String(booking.trip_id) === String(activeTripId),
    ),
    reminders: reminders.filter(
      (reminder) => String(reminder.trip_id) === String(activeTripId),
    ),
    pastMemories,
    loading,
    error,
    reload: load,
    createTrip,
    addItineraryItem,
    updateBudget,
    addExpense,
    addBooking,
    addReminder,
    endTrip,
    executeAssistantAction,
  }), [
    activeExpenses,
    activeTrip,
    activeTripId,
    addBooking,
    addExpense,
    addItineraryItem,
    addReminder,
    endTrip,
    budget,
    bookings,
    createTrip,
    error,
    executeAssistantAction,
    expenses,
    explorePlaces,
    activeItinerary,
    load,
    loading,
    pastMemories,
    reminders,
    savedPlaces,
    savePlace,
    trips,
    unsavePlace,
    updateBudget,
  ]);

  return (
    <TripStoreContext.Provider value={value}>
      {children}
    </TripStoreContext.Provider>
  );
}

export function useTripStore() {
  const store = useContext(TripStoreContext);
  if (!store) {
    throw new Error("useTripStore must be used within a TripStoreProvider.");
  }
  return store;
}
