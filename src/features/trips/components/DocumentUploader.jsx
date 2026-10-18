import { useState } from "react";
import { FileUp, LoaderCircle, Sparkles } from "lucide-react";
import { parseDocument } from "../../../services/ai/parseDocument.js";
import { useTripStore } from "../store/useTripStore.jsx";

function DocumentUploader({ tripId, onComplete }) {
  const { addBooking, addExpense, addReminder } = useTripStore();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function processDocument(event) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    let addedItems = false;
    try {
      const parsed = await parseDocument(file, tripId);
      const created = [];
      if (parsed.booking) {
        await addBooking({ ...parsed.booking, tripId });
        addedItems = true;
        created.push("booking");
      }
      if (parsed.expense) {
        const expense = await addExpense({ ...parsed.expense, tripId });
        addedItems = true;
        created.push(
          expense.status === "pending" ? "pending expense" : "expense",
        );
      }
      if (parsed.reminder) {
        await addReminder({ ...parsed.reminder, tripId });
        addedItems = true;
        created.push("reminder");
      }
      if (!created.length) {
        throw new Error(
          "The parser returned no booking, expense, or reminder to add.",
        );
      }
      setMessage(`Added from the document: ${created.join(", ")}.`);
      setFile(null);
      event.currentTarget.reset();
    } catch (processError) {
      console.error("Could not process travel document:", processError);
      setError(
        processError instanceof Error
          ? processError.message
          : "Could not process this document.",
      );
    } finally {
      try {
        if (addedItems) {
          await onComplete?.();
        }
      } catch (refreshError) {
        console.error("Could not refresh trip details after document import:", refreshError);
        setError(
          refreshError instanceof Error
            ? `Imported items, but could not refresh trip details: ${refreshError.message}`
            : "Imported items, but could not refresh trip details.",
        );
      } finally {
        setBusy(false);
      }
    }
  }

  return (
    <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-white p-2 text-indigo-700 shadow-sm">
          <Sparkles aria-hidden="true" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-slate-950">Import a travel document</h2>
          <p className="mt-1 text-sm text-slate-600">
            Upload a booking, ticket, or receipt. Komsan will add parsed items
            to the selected trip.
          </p>
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={processDocument}
          >
            <input
              accept=".pdf,image/jpeg,image/png,image/webp"
              aria-label="Select a travel document"
              className="min-w-0 flex-1 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-800"
              disabled={busy || !tripId}
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setMessage("");
                setError("");
              }}
              type="file"
            />
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy || !file || !tripId}
              type="submit"
            >
              {busy ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
              ) : (
                <FileUp aria-hidden="true" size={16} />
              )}
              {busy ? "Processing…" : "Upload & parse"}
            </button>
          </form>
          {!tripId && (
            <p className="mt-2 text-xs text-amber-800">
              Select a trip to import a document.
            </p>
          )}
          {message && (
            <p className="mt-2 text-sm text-emerald-800" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default DocumentUploader;
