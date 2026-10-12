import { useMemo, useState } from "react";
import {
  Bus,
  Bell,
  Check,
  CheckSquare,
  ChevronDown,
  Clock3,
  Hotel,
  LoaderCircle,
  MapPin,
  PackageCheck,
  Pencil,
  Plus,
  Trash2,
  TrainFront,
  Plane,
  Ship,
  Car,
  X,
} from "lucide-react";
import accommodationApi from "../../../services/api/accommodation_api.js";
import checklistApi from "../../../services/api/check_list_api.js";
import checklistItemApi from "../../../services/api/check_list_item_api.js";
import packingApi from "../../../services/api/packing_api.js";
import packingListApi from "../../../services/api/packing_list_api.js";
import transportApi from "../../../services/api/transport_api.js";
import DocumentUploader from "./DocumentUploader.jsx";

const FIELD_CLASS =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:opacity-60";

const FORM_FIELDS = {
  accommodation: [
    { key: "name", label: "Place to stay", required: true, maxLength: 255 },
    { key: "address", label: "Address" },
    { key: "check_in", label: "Check-in", type: "datetime-local", required: true },
    { key: "check_out", label: "Check-out", type: "datetime-local", required: true },
    { key: "room_type", label: "Room type", maxLength: 100 },
    { key: "confirmation_number", label: "Confirmation number", maxLength: 255 },
    { key: "cost", label: "Cost", type: "number", min: 0, step: "0.01" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  transport: [
    {
      key: "type",
      label: "Transport type",
      type: "select",
      required: true,
      options: ["flight", "train", "bus", "taxi", "boat", "other"],
    },
    { key: "provider", label: "Provider", maxLength: 255 },
    { key: "from_location", label: "From", required: true, maxLength: 255 },
    { key: "to_location", label: "To", required: true, maxLength: 255 },
    { key: "departure_time", label: "Departure", type: "datetime-local", required: true },
    { key: "arrival_time", label: "Arrival", type: "datetime-local", required: true },
    { key: "booking_number", label: "Booking number", maxLength: 255 },
    { key: "seat", label: "Seat", maxLength: 100 },
    { key: "cost", label: "Cost", type: "number", min: 0, step: "0.01" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  checklist: [{ key: "title", label: "Checklist name", required: true, maxLength: 255 }],
  checklistItem: [
    { key: "title", label: "What needs doing?", required: true, maxLength: 255 },
    { key: "due_date", label: "Due date", type: "date" },
  ],
  packingList: [{ key: "name", label: "Packing list name", required: true, maxLength: 255 }],
  packingItem: [
    { key: "name", label: "Item", required: true, maxLength: 200 },
    { key: "category", label: "Category", maxLength: 100 },
    { key: "quantity", label: "Quantity", type: "number", min: 1, step: 1, required: true },
  ],
};

const EMPTY_VALUES = {
  accommodation: {
    name: "",
    address: "",
    check_in: "",
    check_out: "",
    room_type: "",
    confirmation_number: "",
    cost: "",
    notes: "",
  },
  transport: {
    type: "bus",
    provider: "",
    from_location: "",
    to_location: "",
    departure_time: "",
    arrival_time: "",
    booking_number: "",
    seat: "",
    cost: "",
    notes: "",
  },
  checklist: { title: "" },
  checklistItem: { title: "", due_date: "" },
  packingList: { name: "" },
  packingItem: { name: "", category: "", quantity: 1 },
};

function toLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatCost(value, currency) {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  if (currency && /^[A-Za-z]{3}$/.test(currency)) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return amount.toFixed(2);
}

function formatType(value) {
  if (!value) return "Transport";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function initialFormValues(kind, record, parentId) {
  const values = { ...EMPTY_VALUES[kind] };
  if (kind === "checklistItem" || kind === "packingItem") {
    values[kind === "checklistItem" ? "checklist_id" : "packing_list_id"] =
      parentId;
  }

  if (!record) return values;

  if (kind === "packingItem") {
    const data = record.data || {};
    return {
      ...values,
      name: record.name || "",
      category: data.category || "",
      quantity: data.quantity || 1,
      packing_list_id: parentId,
    };
  }

  for (const field of FORM_FIELDS[kind]) {
    let value = record[field.key] ?? values[field.key] ?? "";
    if (field.type === "datetime-local") value = toLocalDateTime(value);
    values[field.key] = value;
  }
  return values;
}

function toApiPayload(kind, values, tripId) {
  const payload = { ...values };
  if (kind === "accommodation" || kind === "transport") {
    payload.trip_id = tripId;
  }
  if (kind === "checklist") payload.trip_id = tripId;
  if (kind === "packingList") payload.trip_id = tripId;
  if (kind === "checklistItem") {
    payload.checklist_id = Number(payload.checklist_id);
    payload.due_date = payload.due_date || null;
  }
  if (kind === "packingItem") {
    const listId = Number(payload.packing_list_id);
    delete payload.packing_list_id;
    payload.quantity = Number(payload.quantity);
    payload.data = {
      trip_id: tripId,
      packing_list_id: listId || null,
      category: payload.category || null,
      quantity: payload.quantity,
      is_packed: false,
    };
    payload.description = "";
  }
  for (const key of ["cost"]) {
    if (key in payload) payload[key] = payload[key] === "" ? null : Number(payload[key]);
  }
  for (const key of ["check_in", "check_out", "departure_time", "arrival_time"]) {
    if (key in payload) payload[key] = new Date(payload[key]).toISOString();
  }
  for (const key of Object.keys(payload)) {
    if (typeof payload[key] === "string") payload[key] = payload[key].trim() || null;
  }
  return payload;
}

function SectionHeader({ icon: Icon, title, count, onAdd, disabled, actionLabel }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <Icon className="text-teal-700" size={16} />
        {title}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {count}
        </span>
      </h3>
      <button
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={disabled}
        onClick={onAdd}
        type="button"
      >
        <Plus size={14} />
        {actionLabel}
      </button>
    </div>
  );
}

function TripPlanningPanel({ trip, resources, onReload }) {
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const tripId = Number(trip.id);
  const canUseApi = Number.isSafeInteger(tripId) && tripId > 0;

  const tripRecords = useMemo(() => {
    const tripMatches = (item) => String(item.trip_id) === String(trip.id);
    const checklistIds = new Set(
      resources.checklists.filter(tripMatches).map((item) => String(item.id)),
    );
    const packingLists = resources.packingLists.filter(tripMatches);
    const packingListIds = new Set(packingLists.map((item) => String(item.id)));

    return {
      accommodations: resources.accommodations.filter(tripMatches),
      transports: resources.transports.filter(tripMatches),
      reminders: resources.reminders.filter(tripMatches),
      checklists: resources.checklists.filter(tripMatches),
      checklistItems: resources.checklistItems.filter((item) =>
        checklistIds.has(String(item.checklist_id)),
      ),
      packingLists,
      packingItems: resources.packingItems.filter((item) => {
        const data = item.data || {};
        return (
          String(data.trip_id) === String(trip.id) &&
          (!data.packing_list_id ||
            packingListIds.has(String(data.packing_list_id)))
        );
      }),
    };
  }, [resources, trip.id]);

  function openForm(kind, record = null, parentId = null) {
    setForm({
      kind,
      recordId: record?.id ?? null,
      parentId,
      values: initialFormValues(kind, record, parentId),
    });
    setFormError("");
    setActionError("");
  }

  function closeForm() {
    if (isSaving) return;
    setForm(null);
    setFormError("");
  }

  function updateFormField(key, value) {
    setForm((current) => ({
      ...current,
      values: { ...current.values, [key]: value },
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const { kind, recordId, values } = form;
    const fields = FORM_FIELDS[kind];
    if (fields.some((field) => field.required && !String(values[field.key] ?? "").trim())) {
      setFormError("Complete all required fields before saving.");
      return;
    }
    if (
      kind === "accommodation" &&
      new Date(values.check_out) <= new Date(values.check_in)
    ) {
      setFormError("Check-out must be after check-in.");
      return;
    }
    if (
      kind === "transport" &&
      new Date(values.arrival_time) < new Date(values.departure_time)
    ) {
      setFormError("Arrival cannot be earlier than departure.");
      return;
    }

    const payload = toApiPayload(kind, values, tripId);
    const api = {
      accommodation: accommodationApi,
      transport: transportApi,
      checklist: checklistApi,
      checklistItem: checklistItemApi,
      packingList: packingListApi,
      packingItem: packingApi,
    }[kind];

    setIsSaving(true);
    setFormError("");
    setActionError("");
    try {
      if (recordId === null) {
        await api.create(payload);
      } else {
        await api.update(recordId, payload);
      }
      setForm(null);
      await onReload();
    } catch (error) {
      console.error(`Could not save trip ${kind}:`, error);
      setFormError(
        error instanceof Error ? error.message : `Could not save ${kind}.`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function performDelete(key, task) {
    if (!window.confirm("Delete this trip item? This cannot be undone.")) return;
    setBusyKey(key);
    setActionError("");
    try {
      await task();
      await onReload();
    } catch (error) {
      console.error("Could not delete trip planning item:", error);
      setActionError(
        error instanceof Error ? error.message : "Could not delete this item.",
      );
    } finally {
      setBusyKey("");
    }
  }

  async function toggleChecklistItem(item) {
    setBusyKey(`checklist-${item.id}`);
    setActionError("");
    try {
      await checklistItemApi.update(item.id, {
        is_completed: !item.is_completed,
      });
      await onReload();
    } catch (error) {
      console.error("Could not update checklist item:", error);
      setActionError(
        error instanceof Error ? error.message : "Could not update checklist item.",
      );
    } finally {
      setBusyKey("");
    }
  }

  async function togglePackingItem(item) {
    setBusyKey(`packing-${item.id}`);
    setActionError("");
    const itemData = item.data || {};
    let replacement;
    try {
      replacement = await packingApi.create({
        name: item.name,
        description: item.description || "",
        data: {
          ...itemData,
          is_packed: !itemData.is_packed,
        },
      });
      await packingApi.remove(item.id);
      await onReload();
    } catch (error) {
      if (replacement?.id) {
        try {
          await packingApi.remove(replacement.id);
        } catch (cleanupError) {
          console.error("Could not roll back packing-item update:", cleanupError);
        }
      }
      console.error("Could not update packing item:", error);
      setActionError(
        error instanceof Error ? error.message : "Could not update packing item.",
      );
    } finally {
      setBusyKey("");
    }
  }

  function renderField(field) {
    const value = form.values[field.key] ?? "";
    const sharedProps = {
      className: FIELD_CLASS,
      disabled: isSaving,
      maxLength: field.maxLength,
      min: field.min,
      onChange: (event) => updateFormField(field.key, event.target.value),
      required: field.required,
      step: field.step,
      value,
    };

    if (field.type === "textarea") {
      return <textarea {...sharedProps} rows={3} />;
    }
    if (field.type === "select") {
      return (
        <select {...sharedProps}>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {formatType(option)}
            </option>
          ))}
        </select>
      );
    }
    return <input {...sharedProps} type={field.type || "text"} />;
  }

  const checklistItemCount = tripRecords.checklistItems.length;
  const doneChecklistCount = tripRecords.checklistItems.filter(
    (item) => item.is_completed,
  ).length;
  const packedCount = tripRecords.packingItems.filter(
    (item) => item.data?.is_packed,
  ).length;
  const featuredStay = tripRecords.accommodations[0];
  const featuredTransport = tripRecords.transports[0];

  return (
    <details className="mt-4 border-t border-slate-100 pt-3">
      <summary className="cursor-pointer list-none py-2 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          <span>Your trip details</span>
          <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-slate-500">
            {tripRecords.accommodations.length} stays ·{" "}
            {tripRecords.transports.length} rides
            <ChevronDown size={16} />
          </span>
        </span>
        <span className="mt-2 block text-xs font-normal leading-5 text-slate-600">
          {featuredStay
            ? `Stay: ${featuredStay.name}`
            : "No accommodation booked"}
          {" · "}
          {featuredTransport
            ? `${formatType(featuredTransport.type)}: ${featuredTransport.from_location} → ${featuredTransport.to_location}`
            : "No transport added"}
        </span>
        {(checklistItemCount > 0 || tripRecords.packingItems.length > 0) && (
          <span className="mt-1 block text-[11px] font-normal text-slate-500">
            {checklistItemCount
              ? `${doneChecklistCount}/${checklistItemCount} tasks done`
              : ""}
            {checklistItemCount && tripRecords.packingItems.length ? " · " : ""}
            {tripRecords.packingItems.length
              ? `${packedCount}/${tripRecords.packingItems.length} packing items packed`
              : ""}
          </span>
        )}
      </summary>

      {!canUseApi && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          This trip is saved only in this browser. Save it to your account before
          adding bookings, checklists, or packing lists.
        </p>
      )}

      {canUseApi && (
        <div className="mb-4">
          <DocumentUploader tripId={tripId} onComplete={onReload} />
        </div>
      )}

      {actionError && (
        <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
          {actionError}
        </p>
      )}

      {form && (
        <form
          className="mb-4 rounded-xl border border-teal-100 bg-teal-50/40 p-4"
          onSubmit={handleSubmit}
        >
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800">
              {form.recordId === null ? "Add" : "Edit"}{" "}
              {form.kind === "checklistItem"
                ? "checklist item"
                : form.kind === "packingItem"
                  ? "packing item"
                  : form.kind === "packingList"
                    ? "packing list"
                    : form.kind}
            </h4>
            <button
              aria-label="Close form"
              className="rounded p-1 text-slate-500 hover:bg-white"
              disabled={isSaving}
              onClick={closeForm}
              type="button"
            >
              <X size={16} />
            </button>
          </div>
          {formError && (
            <p className="mb-3 text-xs text-rose-700" role="alert">
              {formError}
            </p>
          )}
          {form.kind === "packingItem" && (
            <label className="mb-3 block text-xs font-semibold text-slate-600">
              Packing list
              <select
                className={`${FIELD_CLASS} mt-1`}
                disabled={isSaving}
                onChange={(event) =>
                  updateFormField("packing_list_id", event.target.value)
                }
                required
                value={form.values.packing_list_id || ""}
              >
                <option value="">Choose a list</option>
                {tripRecords.packingLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {FORM_FIELDS[form.kind].map((field) => (
              <label
                className={`block text-xs font-semibold text-slate-600 ${
                  field.type === "textarea" ? "sm:col-span-2" : ""
                }`}
                key={field.key}
              >
                {field.label}
                <span className="mt-1 block">{renderField(field)}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
              disabled={isSaving}
              onClick={closeForm}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              disabled={isSaving}
              type="submit"
            >
              {isSaving && <LoaderCircle className="animate-spin" size={13} />}
              Save
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4 pb-2">
        <section className="rounded-xl bg-slate-50 p-3">
          <SectionHeader
            actionLabel="Add stay"
            count={tripRecords.accommodations.length}
            disabled={!canUseApi}
            icon={Hotel}
            onAdd={() => openForm("accommodation")}
            title="Accommodation"
          />
          {tripRecords.accommodations.length ? (
            <div className="mt-3 space-y-2">
              {tripRecords.accommodations.map((stay) => (
                <article className="rounded-lg bg-white p-3" key={stay.id}>
                  <div className="flex justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">
                        {stay.name}
                      </h4>
                      {stay.address && (
                        <p className="mt-1 flex items-start gap-1 text-xs text-slate-500">
                          <MapPin className="mt-0.5 shrink-0" size={13} />
                          {stay.address}
                        </p>
                      )}
                    </div>
                    <RecordActions
                      busy={busyKey === `stay-${stay.id}`}
                      onDelete={() =>
                        performDelete(`stay-${stay.id}`, () =>
                          accommodationApi.remove(stay.id),
                        )
                      }
                      onEdit={() => openForm("accommodation", stay)}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    Check-in {formatDateTime(stay.check_in)} · Check-out{" "}
                    {formatDateTime(stay.check_out)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[stay.room_type, stay.confirmation_number && `Ref ${stay.confirmation_number}`, formatCost(stay.cost, trip.currency)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {stay.notes && (
                    <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">
                      {stay.notes}
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptySection text="No accommodation added yet." />
          )}
        </section>

        <section className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Bell className="text-teal-700" size={16} />
              Trip reminders
            </h3>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {tripRecords.reminders.length}
            </span>
          </div>
          {tripRecords.reminders.length ? (
            <ul className="mt-3 space-y-2">
              {tripRecords.reminders.map((reminder) => (
                <li className="rounded-lg bg-white p-3" key={reminder.id}>
                  <p className="text-sm font-semibold text-slate-800">
                    {reminder.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Due {formatDateTime(reminder.due_date)}
                    {reminder.status
                      ? ` · ${String(reminder.status).toLowerCase()}`
                      : ""}
                  </p>
                  {reminder.description && (
                    <p className="mt-2 text-xs text-slate-600">
                      {reminder.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptySection text="No reminders added yet." />
          )}
        </section>

        <section className="rounded-xl bg-slate-50 p-3">
          <SectionHeader
            actionLabel="Add transport"
            count={tripRecords.transports.length}
            disabled={!canUseApi}
            icon={Bus}
            onAdd={() => openForm("transport")}
            title="Transport"
          />
          {tripRecords.transports.length ? (
            <div className="mt-3 space-y-2">
              {tripRecords.transports.map((ride) => {
                const TransportIcon =
                  ride.type === "flight"
                    ? Plane
                    : ride.type === "train"
                      ? TrainFront
                      : ride.type === "boat"
                        ? Ship
                        : ride.type === "taxi"
                          ? Car
                          : Bus;
                return (
                  <article className="rounded-lg bg-white p-3" key={ride.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-teal-700">
                          <TransportIcon size={14} />
                          {formatType(ride.type)}
                          {ride.provider && ` · ${ride.provider}`}
                        </p>
                        <h4 className="mt-1 text-sm font-semibold text-slate-800">
                          {ride.from_location} <span className="text-slate-400">→</span>{" "}
                          {ride.to_location}
                        </h4>
                      </div>
                      <RecordActions
                        busy={busyKey === `transport-${ride.id}`}
                        onDelete={() =>
                          performDelete(`transport-${ride.id}`, () =>
                            transportApi.remove(ride.id),
                          )
                        }
                        onEdit={() => openForm("transport", ride)}
                      />
                    </div>
                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={13} />
                        {formatDateTime(ride.departure_time)}
                      </span>
                      <span>Arrives {formatDateTime(ride.arrival_time)}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[ride.booking_number && `Booking ${ride.booking_number}`, ride.seat && `Seat ${ride.seat}`, formatCost(ride.cost, trip.currency)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {ride.notes && (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">
                        {ride.notes}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptySection text="No transport details added yet." />
          )}
        </section>

        <section className="rounded-xl bg-slate-50 p-3">
          <SectionHeader
            actionLabel="New checklist"
            count={`${doneChecklistCount}/${checklistItemCount} done`}
            disabled={!canUseApi}
            icon={CheckSquare}
            onAdd={() => openForm("checklist")}
            title="To-do checklists"
          />
          {tripRecords.checklists.length ? (
            <div className="mt-3 space-y-3">
              {tripRecords.checklists.map((list) => {
                const items = tripRecords.checklistItems.filter(
                  (item) => String(item.checklist_id) === String(list.id),
                );
                return (
                  <div className="rounded-lg bg-white p-3" key={list.id}>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-800">
                        {list.title}
                      </h4>
                      <div className="flex items-center gap-1">
                        <button
                          aria-label={`Add item to ${list.title}`}
                          className="rounded p-1.5 text-teal-700 hover:bg-teal-50"
                          disabled={!canUseApi}
                          onClick={() => openForm("checklistItem", null, list.id)}
                          type="button"
                        >
                          <Plus size={15} />
                        </button>
                        <RecordActions
                          busy={busyKey === `checklist-list-${list.id}`}
                          onDelete={() =>
                            performDelete(`checklist-list-${list.id}`, async () => {
                              for (const item of items) {
                                await checklistItemApi.remove(item.id);
                              }
                              await checklistApi.remove(list.id);
                            })
                          }
                          onEdit={() => openForm("checklist", list)}
                        />
                      </div>
                    </div>
                    {items.length ? (
                      <ul className="mt-2 space-y-1.5">
                        {items.map((item) => (
                          <li className="flex items-center gap-2 text-xs" key={item.id}>
                            <button
                              aria-label={item.is_completed ? "Mark not done" : "Mark done"}
                              className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                                item.is_completed
                                  ? "border-teal-700 bg-teal-700 text-white"
                                  : "border-slate-300 bg-white text-transparent"
                              }`}
                              disabled={busyKey === `checklist-${item.id}`}
                              onClick={() => void toggleChecklistItem(item)}
                              type="button"
                            >
                              <Check size={11} />
                            </button>
                            <span
                              className={
                                item.is_completed
                                  ? "flex-1 text-slate-400 line-through"
                                  : "flex-1 text-slate-700"
                              }
                            >
                              {item.title}
                              {item.due_date && (
                                <span className="ml-2 text-[10px] text-slate-400">
                                  Due {item.due_date}
                                </span>
                              )}
                            </span>
                            <RecordActions
                              busy={busyKey === `checklist-item-${item.id}`}
                              onDelete={() =>
                                performDelete(`checklist-item-${item.id}`, () =>
                                  checklistItemApi.remove(item.id),
                                )
                              }
                              onEdit={() => openForm("checklistItem", item, list.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">No tasks yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptySection text="Create a checklist for things to do before or during the trip." />
          )}
        </section>

        <section className="rounded-xl bg-slate-50 p-3">
          <SectionHeader
            actionLabel="New packing list"
            count={`${packedCount}/${tripRecords.packingItems.length} packed`}
            disabled={!canUseApi}
            icon={PackageCheck}
            onAdd={() => openForm("packingList")}
            title="Packing"
          />
          {tripRecords.packingLists.length ? (
            <div className="mt-3 space-y-3">
              {tripRecords.packingLists.map((list) => {
                const items = tripRecords.packingItems.filter(
                  (item) =>
                    String(item.data?.packing_list_id) === String(list.id),
                );
                return (
                  <div className="rounded-lg bg-white p-3" key={list.id}>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-800">
                        {list.name}
                      </h4>
                      <div className="flex items-center gap-1">
                        <button
                          aria-label={`Add item to ${list.name}`}
                          className="rounded p-1.5 text-teal-700 hover:bg-teal-50"
                          disabled={!canUseApi}
                          onClick={() => openForm("packingItem", null, list.id)}
                          type="button"
                        >
                          <Plus size={15} />
                        </button>
                        <RecordActions
                          busy={busyKey === `packing-list-${list.id}`}
                          onDelete={() =>
                            performDelete(`packing-list-${list.id}`, async () => {
                              for (const item of items) {
                                await packingApi.remove(item.id);
                              }
                              await packingListApi.remove(list.id);
                            })
                          }
                          onEdit={() => openForm("packingList", list)}
                        />
                      </div>
                    </div>
                    {items.length ? (
                      <ul className="mt-2 space-y-1.5">
                        {items.map((item) => (
                          <li className="flex items-center gap-2 text-xs" key={item.id}>
                            <button
                              aria-label={item.data?.is_packed ? "Unpack item" : "Mark packed"}
                              className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                                item.data?.is_packed
                                  ? "border-teal-700 bg-teal-700 text-white"
                                  : "border-slate-300 bg-white text-transparent"
                              }`}
                              disabled={busyKey === `packing-${item.id}`}
                              onClick={() => void togglePackingItem(item)}
                              type="button"
                            >
                              <Check size={11} />
                            </button>
                            <span
                              className={
                                item.data?.is_packed
                                  ? "flex-1 text-slate-400 line-through"
                                  : "flex-1 text-slate-700"
                              }
                            >
                              {item.name}
                              {Number(item.data?.quantity) > 1 &&
                                ` × ${item.data.quantity}`}
                              {item.data?.category && (
                                <span className="ml-2 text-[10px] text-slate-400">
                                  {item.data.category}
                                </span>
                              )}
                            </span>
                            <RecordActions
                              busy={busyKey === `packing-item-${item.id}`}
                              canEdit={false}
                              onDelete={() =>
                                performDelete(`packing-item-${item.id}`, () =>
                                  packingApi.remove(item.id),
                                )
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">No items yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptySection text="Create a packing list, then add the things you need to bring." />
          )}
          <p className="mt-2 text-[10px] leading-4 text-slate-400">
            Packing items are stored in the account's packing service and linked
            to this trip in their metadata.
          </p>
        </section>
      </div>
    </details>
  );
}

function EmptySection({ text }) {
  return <p className="mt-3 text-xs text-slate-400">{text}</p>;
}

function RecordActions({ onEdit, onDelete, busy, canEdit = true }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {canEdit && (
        <button
          aria-label="Edit"
          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-teal-700"
          onClick={onEdit}
          type="button"
        >
          <Pencil size={13} />
        </button>
      )}
      <button
        aria-label="Delete"
        className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
        disabled={busy}
        onClick={onDelete}
        type="button"
      >
        {busy ? (
          <LoaderCircle className="animate-spin" size={13} />
        ) : (
          <Trash2 size={13} />
        )}
      </button>
    </div>
  );
}

export default TripPlanningPanel;
