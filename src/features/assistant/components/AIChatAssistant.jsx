import { useMemo, useRef, useState } from "react";
import {
  Bot,
  LoaderCircle,
  MessageSquare,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { apiRequest } from "../../../services/api/httpClient.js";
import aiConversationApi from "../../../services/api/ai_conversation_api.js";
import aiMessageApi from "../../../services/api/ai_message_api.js";
import { useAuth } from "../../../app/providers/authContext.js";
import { useTripStore } from "../../trips/store/useTripStore.jsx";

function extractToolCalls(message) {
  const raw = String(message || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  if (!candidate.startsWith("{")) return [];
  let payload;
  try {
    payload = JSON.parse(candidate);
  } catch {
    return [];
  }
  const calls = payload.actions || payload.tool_calls || [];
  if (Array.isArray(calls) && calls.length > 0) {
    return calls.map((call) => ({
      name: call.name || call.function?.name,
      args:
        call.arguments ||
        call.function?.arguments ||
        call.parameters ||
        {},
    }));
  }
  if (payload.function_call) {
    return [{
      name: payload.function_call.name,
      args: payload.function_call.arguments || {},
    }];
  }
  return [];
}

function parseArguments(value) {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error("The assistant returned invalid action arguments.");
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The assistant returned invalid action arguments.");
  }
  return parsed;
}

function AIChatAssistant() {
  const { activeTripId } = useTripStore();
  return <AIChatAssistantPanel key={activeTripId || "no-active-trip"} />;
}

function AIChatAssistantPanel() {
  const { accessToken } = useAuth();
  const {
    activeTrip,
    activeTripId,
    budget,
    executeAssistantAction,
    itinerary,
    savedPlaces,
  } = useTripStore();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);
  const tripContext = useMemo(() => ({
    trip: activeTrip
      ? {
          id: activeTrip.id,
          title: activeTrip.name,
          destination_id: activeTrip.destination_id,
          start_date: activeTrip.start_date,
          end_date: activeTrip.end_date,
          currency: activeTrip.currency,
        }
      : null,
    itinerary: itinerary.map((item) => ({
        id: item.id,
        day: item.day,
        time: item.start_time,
        title: item.title,
        cost: item.estimated_cost,
    })),
    budget,
    savedPlaces: savedPlaces.slice(0, 30).map((place) => ({
      id: place.id,
      name: place.name || place.title,
      item_type: place.item_type,
    })),
  }), [activeTrip, budget, itinerary, savedPlaces]);

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    if (!accessToken) {
      setError("Sign in to use the TripOS assistant.");
      return;
    }
    setBusy(true);
    setError("");
    setDraft("");
    setMessages((current) => [...current, { role: "user", message: text }]);
    try {
      let id = conversationId;
      if (!id) {
        const user = await apiRequest("/users/me");
        const conversation = await aiConversationApi.create({
          user_id: user.id,
          trip_id: activeTripId ? Number(activeTripId) : null,
          title: text.slice(0, 60),
        });
        id = String(conversation.id);
        setConversationId(id);
      }
      const contextualMessage = [
        `User request:\n${text}`,
        `Current trip context (JSON):\n${JSON.stringify(tripContext)}`,
        "When the user explicitly requests an app change, respond with a JSON object such as {\"actions\":[{\"name\":\"add_itinerary_item\",\"arguments\":{\"tripId\":1,\"day\":1,\"title\":\"Visit\",\"time\":\"10:00:00\",\"cost\":12}}]} and a short user-facing summary in \"message\". Supported action names: add_itinerary_item, update_budget, add_expense, add_reminder, end_trip. Do not invent IDs or claim an action succeeded unless it is in this JSON.",
      ].join("\n\n");
      const result = await aiMessageApi.send(id, contextualMessage);
      const reply = result.assistant_message?.message || "";
      const calls = extractToolCalls(reply);
      const actionResults = [];
      for (const call of calls) {
        if (!call.name) continue;
        const args = parseArguments(call.args) || {};
        if (activeTripId) args.tripId = Number(activeTripId);
        const actionResult = await executeAssistantAction(call.name, args);
        actionResults.push({ name: call.name, result: actionResult });
      }
      let visibleReply = reply;
      if (calls.length) {
        try {
          const parsed = JSON.parse(
            reply.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim() ||
              reply.trim(),
          );
          visibleReply =
            parsed.message ||
            `Completed ${actionResults.length} trip update${actionResults.length === 1 ? "" : "s"}.`;
        } catch {
          visibleReply = `Completed ${actionResults.length} trip update${actionResults.length === 1 ? "" : "s"}.`;
        }
      }
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          message: visibleReply,
          actions: actionResults.map((item) => item.name),
        },
      ]);
      window.requestAnimationFrame(() =>
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
      );
    } catch (sendError) {
      console.error("TripOS assistant request failed:", sendError);
      setMessages((current) =>
        current.at(-1)?.role === "user" ? current.slice(0, -1) : current,
      );
      setDraft(text);
      setError(
        sendError instanceof Error
          ? sendError.message
          : "The assistant could not complete the request.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!accessToken) return null;

  return (
    <>
      {!isOpen && (
        <button
          aria-label="Open TripOS AI assistant"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-teal-800 px-5 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-teal-900"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <Sparkles aria-hidden="true" size={17} />
          TripOS AI
        </button>
      )}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/30"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <section
            aria-label="TripOS AI assistant"
            aria-modal="true"
            className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            role="dialog"
          >
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-teal-50 p-2 text-teal-800">
                  <Bot aria-hidden="true" size={19} />
                </span>
                <div>
                  <h2 className="font-bold text-slate-950">TripOS AI</h2>
                  <p className="text-xs text-slate-500">
                    {activeTrip?.name || "Travel assistant"}
                  </p>
                </div>
              </div>
              <button
                aria-label="Close assistant"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
              {!messages.length && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm leading-6 text-slate-600">
                  <MessageSquare
                    aria-hidden="true"
                    className="mb-2 text-teal-700"
                    size={19}
                  />
                  Ask about your trip or request an itinerary, budget, expense,
                  or reminder update. I’ll use the selected trip’s current data.
                </div>
              )}
              {messages.map((message, index) => (
                <article
                  className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "ml-auto bg-teal-800 text-white"
                      : "border border-slate-100 bg-white text-slate-700"
                  }`}
                  key={`${message.role}-${index}`}
                >
                  {message.message}
                  {message.actions?.length > 0 && (
                    <p className="mt-2 border-t border-slate-100 pt-2 text-xs font-semibold text-emerald-700">
                      Updated: {message.actions.join(", ")}
                    </p>
                  )}
                </article>
              ))}
              {busy && (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <LoaderCircle className="animate-spin" size={16} />
                  Working with your trip context…
                </p>
              )}
              <div ref={endRef} />
            </div>
            {error && (
              <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <form className="flex gap-2 border-t border-slate-100 p-4" onSubmit={sendMessage}>
              <label className="sr-only" htmlFor="tripos-ai-message">
                Message TripOS AI
              </label>
              <textarea
                className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
                id="tripos-ai-message"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask TripOS…"
                rows={1}
                value={draft}
              />
              <button
                aria-label="Send message"
                className="self-end rounded-xl bg-teal-800 p-3 text-white disabled:opacity-50"
                disabled={busy || !draft.trim()}
                type="submit"
              >
                <Send aria-hidden="true" size={17} />
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

export default AIChatAssistant;
