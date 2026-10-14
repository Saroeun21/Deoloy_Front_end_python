import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import memoryApi from "../../services/api/memory_api.js";
import memoryPhotoApi from "../../services/api/memory_photo_api.js";
import tripApi from "../../services/api/tripapi.js";

function todayAsDateInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  return new Date(today.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 10);
}

function formatMemoryDate(value) {
  if (!value) return "Date not provided";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Date not provided";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
}

function createEmptyMemory(tripId = "") {
  return {
    trip_id: tripId,
    title: "",
    description: "",
    memory_date: todayAsDateInputValue(),
    location: "",
  };
}

function Memory() {
  const [memories, setMemories] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState(null);
  const [formData, setFormData] = useState(() => createEmptyMemory());
  const [isSaving, setIsSaving] = useState(false);
  const [busyMemoryId, setBusyMemoryId] = useState(null);
  const [photoForm, setPhotoForm] = useState(null);
  const [photoActionError, setPhotoActionError] = useState("");
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [busyPhotoId, setBusyPhotoId] = useState(null);

  const loadMemories = useCallback(async (isActive = () => true) => {
    const [memoryResult, tripResult, photoResult] = await Promise.allSettled([
      memoryApi.list(),
      tripApi.list(),
      memoryPhotoApi.list(),
    ]);
    if (!isActive()) return;

    const loadErrors = [];
    if (memoryResult.status === "fulfilled") {
      setMemories(
        [...memoryResult.value].sort(
          (left, right) =>
            new Date(right.memory_date).getTime() -
            new Date(left.memory_date).getTime(),
        ),
      );
    } else {
      console.error("Could not load trip memories:", memoryResult.reason);
      loadErrors.push(
        memoryResult.reason instanceof Error
          ? memoryResult.reason.message
          : "Could not load trip memories.",
      );
    }

    if (tripResult.status === "fulfilled") {
      setTrips(tripResult.value);
    } else {
      console.error("Could not load trips for memories:", tripResult.reason);
      loadErrors.push(
        tripResult.reason instanceof Error
          ? tripResult.reason.message
          : "Could not load trips.",
      );
    }

    if (photoResult.status === "fulfilled") {
      setPhotos(photoResult.value);
      setPhotoError("");
    } else {
      console.error("Could not load memory photos:", photoResult.reason);
      setPhotoError(
        photoResult.reason instanceof Error
          ? photoResult.reason.message
          : "Could not load memory photos.",
      );
    }

    setError(loadErrors.join(" "));
    setLoading(false);
  }, []);

  function retryLoad() {
    setLoading(true);
    setError("");
    void loadMemories();
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => loadMemories(() => !cancelled));
    return () => {
      cancelled = true;
    };
  }, [loadMemories]);

  const tripNames = useMemo(
    () => new Map(trips.map((trip) => [String(trip.id), trip.name])),
    [trips],
  );
  const photosByMemoryId = useMemo(() => {
    const groupedPhotos = new Map();
    for (const photo of photos) {
      const memoryId = String(photo.memory_id);
      const memoryPhotos = groupedPhotos.get(memoryId) || [];
      memoryPhotos.push(photo);
      groupedPhotos.set(memoryId, memoryPhotos);
    }
    return groupedPhotos;
  }, [photos]);

  function openCreateForm() {
    setPhotoForm(null);
    setEditingMemoryId(null);
    setFormData(createEmptyMemory(trips.length ? String(trips[0].id) : ""));
    setActionError("");
    setIsFormOpen(true);
  }

  function openEditForm(memory) {
    setPhotoForm(null);
    setEditingMemoryId(memory.id);
    setFormData({
      trip_id: String(memory.trip_id),
      title: memory.title || "",
      description: memory.description || "",
      memory_date: memory.memory_date || todayAsDateInputValue(),
      location: memory.location || "",
    });
    setActionError("");
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingMemoryId(null);
    setActionError("");
  }

  function openPhotoForm(memory, photo = null) {
    setIsFormOpen(false);
    setPhotoActionError("");
    setPhotoForm({
      memoryId: memory.id,
      photoId: photo?.id ?? null,
      image_path: photo?.image_path || "",
      caption: photo?.caption || "",
      memoryTitle: memory.title,
    });
  }

  function closePhotoForm() {
    if (isSavingPhoto) return;
    setPhotoForm(null);
    setPhotoActionError("");
  }

  async function handlePhotoSubmit(event) {
    event.preventDefault();
    if (!photoForm?.image_path.trim()) {
      setPhotoActionError("Enter an image URL or image path.");
      return;
    }

    const payload = {
      image_path: photoForm.image_path.trim(),
      caption: photoForm.caption.trim() || null,
    };

    setIsSavingPhoto(true);
    setPhotoActionError("");
    try {
      const savedPhoto =
        photoForm.photoId === null
          ? await memoryPhotoApi.create({
              memory_id: photoForm.memoryId,
              ...payload,
            })
          : await memoryPhotoApi.update(photoForm.photoId, payload);
      setPhotos((current) =>
        photoForm.photoId === null
          ? [...current, savedPhoto]
          : current.map((photo) =>
              photo.id === savedPhoto.id ? savedPhoto : photo,
            ),
      );
      setPhotoForm(null);
    } catch (saveError) {
      console.error("Could not save memory photo:", saveError);
      setPhotoActionError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this photo.",
      );
    } finally {
      setIsSavingPhoto(false);
    }
  }

  async function handlePhotoDelete(photo) {
    if (!window.confirm("Delete this photo from the memory?")) return;
    setBusyPhotoId(photo.id);
    setPhotoActionError("");
    try {
      await memoryPhotoApi.remove(photo.id);
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
    } catch (deleteError) {
      console.error("Could not delete memory photo:", deleteError);
      setPhotoActionError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this photo.",
      );
    } finally {
      setBusyPhotoId(null);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!formData.trip_id || !formData.title.trim() || !formData.memory_date) {
      setActionError("Choose a trip and provide a title and date.");
      return;
    }

    const payload = {
      ...(editingMemoryId === null
        ? { trip_id: Number(formData.trip_id) }
        : {}),
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      memory_date: formData.memory_date,
      location: formData.location.trim() || null,
    };

    setIsSaving(true);
    setActionError("");
    try {
      if (editingMemoryId === null) {
        await memoryApi.create(payload);
      } else {
        await memoryApi.update(editingMemoryId, payload);
      }
      setIsFormOpen(false);
      setEditingMemoryId(null);
      setLoading(true);
      await loadMemories();
    } catch (saveError) {
      console.error("Could not save trip memory:", saveError);
      setActionError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this memory.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(memory) {
    if (!window.confirm(`Delete "${memory.title}"? This cannot be undone.`)) {
      return;
    }

    setBusyMemoryId(memory.id);
    setActionError("");
    const deletedPhotoIds = [];
    try {
      const memoryPhotos = photosByMemoryId.get(String(memory.id)) || [];
      for (const photo of memoryPhotos) {
        await memoryPhotoApi.remove(photo.id);
        deletedPhotoIds.push(photo.id);
      }
      await memoryApi.remove(memory.id);
      setMemories((current) =>
        current.filter((item) => item.id !== memory.id),
      );
      setPhotos((current) =>
        current.filter((photo) => !deletedPhotoIds.includes(photo.id)),
      );
    } catch (deleteError) {
      if (deletedPhotoIds.length) {
        setPhotos((current) =>
          current.filter((photo) => !deletedPhotoIds.includes(photo.id)),
        );
      }
      console.error("Could not delete trip memory:", deleteError);
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this memory.",
      );
    } finally {
      setBusyMemoryId(null);
    }
  }

  return (
    <main className="min-h-full bg-slate-50 p-5 text-slate-800 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
              After the journey
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Trip memories
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Keep the little moments and stories from every trip in one place.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!trips.length || loading}
            onClick={openCreateForm}
            type="button"
          >
            <Plus size={17} />
            Add a memory
          </button>
        </header>

        {error && (
          <div
            className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <span>{error}</span>
            <button
              className="font-semibold underline underline-offset-2"
              onClick={retryLoad}
              type="button"
            >
              Try again
            </button>
          </div>
        )}

        {photoError && (
          <div
            className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <span>Memory photos could not be loaded: {photoError}</span>
            <button
              className="font-semibold underline underline-offset-2"
              onClick={retryLoad}
              type="button"
            >
              Retry
            </button>
          </div>
        )}

        {actionError && !isFormOpen && (
          <p
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            role="alert"
          >
            {actionError}
          </p>
        )}

        {photoActionError && !photoForm && (
          <p
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            role="alert"
          >
            {photoActionError}
          </p>
        )}

        {(isFormOpen || photoForm) && (
          <section
            aria-labelledby={
              photoForm && !isFormOpen
                ? "memory-photo-form-title"
                : "memory-form-title"
            }
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"
          >
            {isFormOpen && (
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-lg font-bold" id="memory-form-title">
                  {editingMemoryId === null ? "Add a trip memory" : "Edit memory"}
                </h2>
                <button
                  aria-label="Close memory form"
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
                  disabled={isSaving}
                  onClick={closeForm}
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {isFormOpen && actionError && (
              <p
                className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                role="alert"
              >
                {actionError}
              </p>
            )}

            {photoForm && (
              <section
                aria-labelledby="memory-photo-form-title"
                className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"
              >
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold" id="memory-photo-form-title">
                      {photoForm.photoId === null ? "Add a photo" : "Edit photo"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      For {photoForm.memoryTitle}
                    </p>
                  </div>
                  <button
                    aria-label="Close photo form"
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
                    disabled={isSavingPhoto}
                    onClick={closePhotoForm}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>

                {photoActionError && (
                  <p
                    className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                    role="alert"
                  >
                    {photoActionError}
                  </p>
                )}

                <form className="grid gap-4 sm:grid-cols-2" onSubmit={handlePhotoSubmit}>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                    Image URL or path
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      disabled={isSavingPhoto}
                      maxLength={500}
                      onChange={(event) =>
                        setPhotoForm((current) => ({
                          ...current,
                          image_path: event.target.value,
                        }))
                      }
                      placeholder="https://example.com/photo.jpg"
                      required
                      value={photoForm.image_path}
                    />
                    <span className="font-normal text-slate-400">
                      Add a publicly reachable image URL or a path supported by your
                      backend. File uploads are not supported by this endpoint.
                    </span>
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                    Caption <span className="font-normal text-slate-400">Optional</span>
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      disabled={isSavingPhoto}
                      maxLength={255}
                      onChange={(event) =>
                        setPhotoForm((current) => ({
                          ...current,
                          caption: event.target.value,
                        }))
                      }
                      placeholder="Add a note about this photo"
                      value={photoForm.caption}
                    />
                  </label>
                  <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
                    <button
                      className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                      disabled={isSavingPhoto}
                      onClick={closePhotoForm}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isSavingPhoto}
                      type="submit"
                    >
                      {isSavingPhoto && (
                        <LoaderCircle className="animate-spin" size={16} />
                      )}
                      {photoForm.photoId === null ? "Save photo" : "Update photo"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {isFormOpen && (
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Trip
                <select
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  disabled={editingMemoryId !== null || isSaving}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      trip_id: event.target.value,
                    }))
                  }
                  required
                  value={formData.trip_id}
                >
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Memory date
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  disabled={isSaving}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      memory_date: event.target.value,
                    }))
                  }
                  required
                  type="date"
                  value={formData.memory_date}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                Title
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  disabled={isSaving}
                  maxLength={255}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="A moment worth remembering"
                  required
                  value={formData.title}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                Location <span className="font-normal text-slate-400">Optional</span>
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  disabled={isSaving}
                  maxLength={255}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                  placeholder="Where did it happen?"
                  value={formData.location}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                Story <span className="font-normal text-slate-400">Optional</span>
                <textarea
                  className="min-h-24 resize-y rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  disabled={isSaving}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Write down what made this moment special..."
                  rows={3}
                  value={formData.description}
                />
              </label>

              <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
                <button
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  disabled={isSaving}
                  onClick={closeForm}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSaving || !trips.length}
                  type="submit"
                >
                  {isSaving && <LoaderCircle className="animate-spin" size={16} />}
                  {editingMemoryId === null ? "Save memory" : "Update memory"}
                </button>
              </div>
              </form>
            )}
          </section>
        )}

        {loading ? (
          <div
            className="flex items-center justify-center gap-2 rounded-2xl bg-white p-12 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200"
            role="status"
          >
            <LoaderCircle className="animate-spin" size={18} />
            Loading memories…
          </div>
        ) : memories.length ? (
          <section aria-label="Your trip memories">
            <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
              <span>
                {memories.length} {memories.length === 1 ? "memory" : "memories"}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {memories.map((memory) => (
                <article
                  className="flex min-h-52 flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
                  key={memory.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
                        {tripNames.get(String(memory.trip_id)) || "Trip"}
                      </p>
                      <h2 className="mt-2 break-words text-lg font-bold text-slate-800">
                        {memory.title}
                      </h2>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        aria-label={`Edit ${memory.title}`}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-teal-700 disabled:opacity-50"
                        disabled={busyMemoryId === memory.id}
                        onClick={() => openEditForm(memory)}
                        type="button"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        aria-label={`Delete ${memory.title}`}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                        disabled={busyMemoryId === memory.id}
                        onClick={() => void handleDelete(memory)}
                        type="button"
                      >
                        {busyMemoryId === memory.id ? (
                          <LoaderCircle className="animate-spin" size={16} />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={14} />
                      {formatMemoryDate(memory.memory_date)}
                    </span>
                    {memory.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={14} />
                        {memory.location}
                      </span>
                    )}
                  </div>

                  {memory.description && (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {memory.description}
                    </p>
                  )}

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-700">
                        Photos
                      </h3>
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                        onClick={() => openPhotoForm(memory)}
                        type="button"
                      >
                        <ImagePlus size={15} />
                        Add photo
                      </button>
                    </div>
                    {photosByMemoryId.get(String(memory.id))?.length ? (
                      <div className="grid grid-cols-2 gap-2">
                        {photosByMemoryId.get(String(memory.id)).map((photo) => (
                          <figure
                            className="group relative overflow-hidden rounded-xl bg-slate-100"
                            key={photo.id}
                          >
                            <img
                              alt={photo.caption || `Photo for ${memory.title}`}
                              className="h-36 w-full object-cover"
                              loading="lazy"
                              src={photo.image_path}
                            />
                            <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                              <figcaption className="min-w-0 truncate text-xs text-slate-600">
                                {photo.caption || "Trip photo"}
                              </figcaption>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  aria-label={`Edit photo${photo.caption ? `: ${photo.caption}` : ""}`}
                                  className="rounded p-1 text-slate-500 hover:bg-white hover:text-teal-700 disabled:opacity-50"
                                  disabled={busyPhotoId === photo.id}
                                  onClick={() => openPhotoForm(memory, photo)}
                                  type="button"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  aria-label={`Delete photo${photo.caption ? `: ${photo.caption}` : ""}`}
                                  className="rounded p-1 text-slate-500 hover:bg-white hover:text-rose-700 disabled:opacity-50"
                                  disabled={busyPhotoId === photo.id}
                                  onClick={() => void handlePhotoDelete(photo)}
                                  type="button"
                                >
                                  {busyPhotoId === photo.id ? (
                                    <LoaderCircle
                                      className="animate-spin"
                                      size={13}
                                    />
                                  ) : (
                                    <Trash2 size={13} />
                                  )}
                                </button>
                              </div>
                            </div>
                          </figure>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">
                        No photos added yet.
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : !error ? (
          <section className="rounded-2xl bg-white px-6 py-14 text-center shadow-sm ring-1 ring-slate-200">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-teal-50 text-teal-700">
              <CalendarDays size={25} />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-800">
              No memories yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Save a favorite moment from one of your trips and your travel
              journal will start here.
            </p>
            {!trips.length ? (
              <p className="mt-4 text-sm text-slate-500">
                Create a trip first to add a memory.
              </p>
            ) : (
              <button
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
                onClick={openCreateForm}
                type="button"
              >
                <Plus size={17} />
                Add your first memory
              </button>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default Memory;