import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DestinationCard from "../../features/discovery/page/components/DestinationCard";
import { fetchPlaces } from "../../services/api/placeapi.js";
import { getHomeDestinations } from "../../services/api/homeApi.js";
import { getPlaceDetailPath } from "../../features/discovery/page/placeRoutes.js";
import { getSavedItemKey } from "../../features/discovery/page/components/savedItemKey.js";

function Saved({
  savedPlaces = [],
  savedCatalogItems = [],
  onToggleSave = () => {},
  savingPlaceIds = [],
  savedPlacesLoading = false,
  savedPlacesError = "",
}) {
  const navigate = useNavigate();
  const [places, setPlaces] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [placesError, setPlacesError] = useState("");
  const [destinationsError, setDestinationsError] = useState("");
  const [placesReloadKey, setPlacesReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadPlaces() {
      setLoadingPlaces(true);
      setPlacesError("");
      setDestinationsError("");
      const [placesResult, destinationsResult] = await Promise.allSettled([
        fetchPlaces(),
        getHomeDestinations(100),
      ]);
      if (cancelled) return;

      if (placesResult.status === "fulfilled") {
        setPlaces(placesResult.value);
      } else {
        console.error(
          "Could not load places for saved list:",
          placesResult.reason,
        );
        setPlacesError(
          placesResult.reason instanceof Error
            ? placesResult.reason.message
            : "Could not load places.",
        );
      }
      if (destinationsResult.status === "fulfilled") {
        setDestinations(destinationsResult.value);
      } else {
        console.error(
          "Could not load destinations for saved list:",
          destinationsResult.reason,
        );
        setDestinationsError(
          destinationsResult.reason instanceof Error
            ? destinationsResult.reason.message
            : "Could not load destinations.",
        );
      }
      setLoadingPlaces(false);
    }

    void loadPlaces();
    return () => {
      cancelled = true;
    };
  }, [placesReloadKey]);

  const savedItems = useMemo(() => {
    const destinationDailyCosts = new Map(
      destinations.map((destination) => [
        String(destination.id),
        destination.average_daily_cost_usd,
      ]),
    );
    const destinationsByTitle = new Map(
      destinations.flatMap((destination) => {
        const title = destination.country
          ? `${destination.name}, ${destination.country}`
          : destination.name;
        return [
          [title.toLocaleLowerCase(), destination],
          [destination.name.toLocaleLowerCase(), destination],
        ];
      }),
    );
    const savedIds = new Set(savedPlaces.map((id) => String(id)));
    const savedBackendPlaces = places
      .filter((place) => savedIds.has(String(place.id)))
      .map((place) => ({
        ...place,
        title: place.name,
        desc: place.description || "",
        img: place.image || place.image_url || "",
        location: place.address || "",
        tags: place.category ? [place.category] : [],
        kind: "place",
        estimated_daily_cost_usd: destinationDailyCosts.get(
          String(place.destination_id),
        ),
      }));
    const savedExternalItems = savedCatalogItems.map((record) => {
      const matchedDestination = destinationsByTitle.get(
        String(record.title || "").toLocaleLowerCase(),
      );
      return {
        ...record,
        id: record.item_key,
        kind: record.item_type === "destination" ? "destination" : "place",
        title: record.title,
        name: record.title,
        desc: record.description || "",
        description: record.description || "",
        img: record.image || "",
        image: record.image || "",
        location: record.location || "",
        sourceUrl: record.source_url || "",
        item_type: record.item_type,
        item_key: record.item_key,
        average_daily_cost_usd:
          record.item_type === "destination"
            ? matchedDestination?.average_daily_cost_usd
            : undefined,
      };
    });
    return [...savedBackendPlaces, ...savedExternalItems];
  }, [places, destinations, savedPlaces, savedCatalogItems]);

  const isLoading = loadingPlaces || savedPlacesLoading;
  const error = savedPlacesError || placesError || destinationsError;

  return (
    <main className="min-h-full bg-slate-50 p-5 text-slate-800 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 p-8 text-white shadow-xl sm:p-10">
          <div className="relative z-10 max-w-2xl space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">
              Your shortlist
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Saved items
            </h1>
            <p className="text-sm text-teal-100/80">
              Keep destinations and places you love handy while you plan.
            </p>
          </div>
          <div aria-hidden="true" className="absolute -bottom-10 -right-10 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" />
        </header>

        {error && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            <p>{error}</p>
            {(placesError || destinationsError) && (
              <button
                className="mt-2 font-semibold underline underline-offset-2"
                onClick={() => setPlacesReloadKey((key) => key + 1)}
                type="button"
              >
                Retry loading saved item data
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <div
            className="flex items-center justify-center gap-2 rounded-2xl bg-white p-12 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200"
            role="status"
          >
            <LoaderCircle className="animate-spin" size={18} />
            Loading saved places…
          </div>
        ) : savedItems.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {savedItems.map((place) => (
              <DestinationCard
                key={getSavedItemKey(place)}
                item={place}
                isSaved={true}
                isSaving={savingPlaceIds.includes(getSavedItemKey(place))}
                onToggleSave={onToggleSave}
                onAddToTrips={() =>
                  navigate("/trips", { state: { addDestination: place } })
                }
                onClick={() =>
                  navigate(getPlaceDetailPath(place), {
                    state: { destination: place },
                  })
                }
              />
            ))}
          </div>
        ) : error ? null : (
          <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-bold">No saved places yet</h2>
            <p className="mt-2 text-sm text-slate-500">
              Save a place from Home or Explore and it will show up here.
            </p>
            <button
              className="mt-5 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white"
              onClick={() => navigate("/explore")}
              type="button"
            >
              Explore places
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

export default Saved;
