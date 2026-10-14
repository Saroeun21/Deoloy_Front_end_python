import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

import UserNavbar from './shared/components/UserNavbar';
import Home from './screen/userScreen/home';
import Explore from './screen/userScreen/explore';
import Saved from './screen/userScreen/saved';
import Trip from './screen/userScreen/trip';
import Budget from './screen/userScreen/budget';
import AIAssistant from './screen/userScreen/ai_assistant';
import Notification from './screen/userScreen/notification';
import TripMemoriesMain from './features/memories/pages/TripMemoriesMain.jsx';
import PlacePage from './features/discovery/page/PlacePage';
import LoginPage from './features/auth/pages/LoginPage';
import RegisterPage from './features/auth/pages/RegisterPage';
import { AuthProvider } from './app/providers/AuthProviders';
import { TripStoreProvider } from './features/trips/store/useTripStore.jsx';
import AIChatAssistant from './features/assistant/components/AIChatAssistant.jsx';
import { useAuth } from './app/providers/authContext.js';
import savedPlaceApi from './services/api/saved_api.js';
import savedItemApi from './services/api/savedItemApi.js';
import { getSavedItemKey } from './features/discovery/page/components/savedItemKey.js';

function ProtectedPage({ children }) {
  const { accessToken } = useAuth();
  const location = useLocation();
  return accessToken ? (
    children
  ) : (
    <Navigate to="/login" replace state={{ from: location }} />
  );
}

function UserPage() {
  const { accessToken, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [savedPlaceRecords, setSavedPlaceRecords] = useState([]);
  const [savedItemRecords, setSavedItemRecords] = useState([]);
  const [savedPlacesLoadedKey, setSavedPlacesLoadedKey] = useState('');
  const [savedPlacesError, setSavedPlacesError] = useState('');
  const [savingPlaceIds, setSavingPlaceIds] = useState([]);
  const [savedPlacesReloadKey, setSavedPlacesReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!accessToken) return undefined;
    const loadKey = `${accessToken}:${savedPlacesReloadKey}`;

    async function loadSavedPlaces() {
      const [placesResult, itemsResult] = await Promise.allSettled([
        savedPlaceApi.list(),
        savedItemApi.list(),
      ]);
      try {
        if (cancelled) return;
        const errors = [];
        if (placesResult.status === 'fulfilled') {
          setSavedPlaceRecords(placesResult.value);
          setSavedPlaces(placesResult.value.map((record) => record.place_id));
        } else {
          setSavedPlaceRecords([]);
          setSavedPlaces([]);
          errors.push(placesResult.reason);
        }
        if (itemsResult.status === 'fulfilled') {
          setSavedItemRecords(itemsResult.value);
        } else {
          setSavedItemRecords([]);
          errors.push(itemsResult.reason);
        }
        if (errors.length) {
          console.error('Could not load saved items:', errors);
          setSavedPlacesError(
            errors
              .map((error) =>
                error instanceof Error ? error.message : 'Could not load saved items.',
              )
              .join(' '),
          );
        } else {
          setSavedPlacesError('');
        }
      } finally {
        if (!cancelled) setSavedPlacesLoadedKey(loadKey);
      }
    }

    void loadSavedPlaces();
    return () => {
      cancelled = true;
    };
  }, [accessToken, savedPlacesReloadKey]);

  const savedPlacesLoading = Boolean(
    accessToken &&
      savedPlacesLoadedKey !== `${accessToken}:${savedPlacesReloadKey}`,
  );

  const savedItemKeys = [
    ...savedPlaces.map((id) => `place:${String(id)}`),
    ...savedItemRecords.map(
      (record) => `${record.item_type}:${String(record.item_key)}`,
    ),
  ];
  const handleToggleSave = async (item) => {
    if (!accessToken) {
      navigate('/login', { state: { from: location } });
      return;
    }
    const saveKey = getSavedItemKey(item);
    if (!saveKey) return;
    if (
      savingPlaceIds.some(
        (savingId) => savingId === saveKey,
      )
    ) {
      return;
    }

    setSavingPlaceIds((current) => [...current, saveKey]);
    setSavedPlacesError('');
    try {
      const [itemType, itemKey] = saveKey.split(':', 2);
      if (itemType === 'place') {
        const savedRecord = savedPlaceRecords.find(
          (record) => String(record.place_id) === itemKey,
        );
        if (savedRecord) {
          await savedPlaceApi.remove(savedRecord.id);
          setSavedPlaceRecords((current) =>
            current.filter((record) => record.id !== savedRecord.id),
          );
          setSavedPlaces((current) =>
            current.filter((id) => String(id) !== itemKey),
          );
        } else {
          const record = await savedPlaceApi.save(itemKey);
          setSavedPlaceRecords((current) => [...current, record]);
          setSavedPlaces((current) =>
            current.some((id) => String(id) === itemKey)
              ? current
              : [...current, record.place_id],
          );
        }
      } else {
        const savedRecord = savedItemRecords.find(
          (record) =>
            record.item_type === itemType &&
            String(record.item_key) === itemKey,
        );
        if (savedRecord) {
          await savedItemApi.remove(savedRecord.id);
          setSavedItemRecords((current) =>
            current.filter((record) => record.id !== savedRecord.id),
          );
        } else {
          const record = await savedItemApi.save({
            ...item,
            item_type: itemType,
            item_key: itemKey,
          });
          setSavedItemRecords((current) => [...current, record]);
        }
      }
    } catch (error) {
      console.error('Could not update saved items:', error);
      setSavedPlacesError(
        error instanceof Error ? error.message : 'Could not update saved places.',
      );
    } finally {
      setSavingPlaceIds((current) =>
        current.filter((key) => key !== saveKey),
      );
    }
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-50">
      <UserNavbar
        onSignOut={signOut}
        isSignedIn={Boolean(accessToken)}
      />
      <main className="app-main-scroll min-h-0 min-w-0 flex-1 overflow-y-auto">
        {accessToken && savedPlacesError && (
          <div
            className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 md:mx-8"
            role="alert"
          >
            <span>{savedPlacesError}</span>
            <button
              aria-label="Dismiss saved places error"
              className="font-semibold"
              onClick={() => {
                setSavedPlacesError('');
                setSavedPlacesLoadedKey('');
                setSavedPlacesReloadKey((key) => key + 1);
              }}
              type="button"
            >
              Retry
            </button>
          </div>
        )}
        <Routes>
          <Route
            path="/"
            element={
              <Home
                savedItemKeys={savedItemKeys}
                onToggleSave={handleToggleSave}
                savingPlaceIds={savingPlaceIds}
              />
            }
          />
          <Route
            path="/explore"
            element={
              <Explore
                savedItemKeys={savedItemKeys}
                onToggleSave={handleToggleSave}
                savingPlaceIds={savingPlaceIds}
              />
            }
          />
          <Route
            path="/places/:placeType/:placeId"
            element={
              <PlacePage
                savedItemKeys={savedItemKeys}
                onToggleSave={handleToggleSave}
                savingPlaceIds={savingPlaceIds}
              />
            }
          />
          <Route
            path="/places/:placeId"
            element={
              <PlacePage
                savedItemKeys={savedItemKeys}
                onToggleSave={handleToggleSave}
                savingPlaceIds={savingPlaceIds}
              />
            }
          />
          <Route
            path="/saved"
            element={
              <ProtectedPage>
                <Saved
                  savedPlaces={savedPlaces}
                  savedCatalogItems={savedItemRecords}
                  onToggleSave={handleToggleSave}
                  savingPlaceIds={savingPlaceIds}
                  savedPlacesLoading={savedPlacesLoading}
                  savedPlacesError={savedPlacesError}
                />
              </ProtectedPage>
            }
          />
          <Route
            path="/trips"
            element={
              <ProtectedPage>
                <Trip />
              </ProtectedPage>
            }
          />
          <Route
            path="/login"
            element={
              accessToken ? (
                <Navigate
                  to={location.state?.from?.pathname || '/'}
                  replace
                  state={location.state?.from?.state}
                />
              ) : (
                <LoginPage />
              )
            }
          />
          <Route
            path="/register"
            element={
              accessToken ? (
                <Navigate
                  to={location.state?.from?.pathname || '/'}
                  replace
                  state={location.state?.from?.state}
                />
              ) : (
                <RegisterPage />
              )
            }
          />
          <Route
            path="/budget"
            element={
              <ProtectedPage>
                <Budget />
              </ProtectedPage>
            }
          />
          <Route
            path="/ai"
            element={
              <ProtectedPage>
                <AIAssistant />
              </ProtectedPage>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedPage>
                <Notification />
              </ProtectedPage>
            }
          />
          <Route
            path="/memories"
            element={<TripMemoriesMain />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <AIChatAssistant />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TripStoreProvider>
        <UserPage />
      </TripStoreProvider>
    </AuthProvider>
  );
}