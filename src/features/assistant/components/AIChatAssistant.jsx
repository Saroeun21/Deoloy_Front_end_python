import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  History,
  LoaderCircle,
  MapPin,
  MessageSquare,
  Plus,
  Send,
  X,
} from "lucide-react";
import { apiRequest } from "../../../services/api/httpClient.js";
import aiConversationApi from "../../../services/api/ai_conversation_api.js";
import aiMessageApi from "../../../services/api/ai_message_api.js";
import { useAuth } from "../../../app/providers/authContext.js";
import { useTripStore } from "../../trips/store/useTripStore.jsx";
import ChatbotLogo from "../../../assets/Logo/chatbot.png";

const OPEN_ASSISTANT_EVENT = "tripos:open-assistant";

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

function getVisibleMessage(message) {
  const text = String(message || "");
  const userPrefix = "User request:\n";
  const contextSeparator = "\n\nCurrent trip context (JSON):";
  if (text.startsWith(userPrefix) && text.includes(contextSeparator)) {
    return text.slice(
      userPrefix.length,
      text.indexOf(contextSeparator, userPrefix.length),
    );
  }
  if (!text.trim().startsWith("{") && !text.includes("```")) return text;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  try {
    const payload = JSON.parse(fenced ? fenced[1].trim() : text);
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
    if (Array.isArray(payload.actions) && payload.actions.length === 0) {
      return "I couldn't generate a reply. Please try again.";
    }
    return text;
  } catch {
    return text;
  }
}

function AIChatAssistant() {
  return <AIChatAssistantPanel />;
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
    trips,
  } = useTripStore();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState("");
  const [conversations, setConversations] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(activeTripId || "");
  const [userId, setUserId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);
  const conversationIdRef = useRef("");
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

  const activeMessages = useMemo(
    () =>
      messages
        .filter(
          (message) =>
            String(message.conversation_id) === String(conversationId),
        )
        .sort(
          (left, right) =>
            new Date(left.created_at).getTime() -
            new Date(right.created_at).getTime(),
        ),
    [conversationId, messages],
  );
  const selectedTrip = trips.find(
    (trip) => String(trip.id) === String(selectedTripId),
  );

  const loadChatData = useCallback(async () => {
    try {
      const [conversationData, messageData, user] = await Promise.all([
        aiConversationApi.list(),
        aiMessageApi.list(),
        apiRequest("/users/me"),
      ]);
      if (
        !Array.isArray(conversationData) ||
        !Array.isArray(messageData) ||
        !user?.id
      ) {
        throw new Error("The assistant returned invalid conversation data.");
      }
      const selected =
        conversationData.find(
          (conversation) =>
            String(conversation.id) === String(conversationIdRef.current),
        ) || conversationData[0];
      const nextConversationId = selected ? String(selected.id) : "";
      conversationIdRef.current = nextConversationId;
      setConversations(conversationData);
      setMessages(messageData);
      setUserId(user.id);
      setConversationId(nextConversationId);
      setSelectedTripId(
        selected
          ? selected.trip_id
            ? String(selected.trip_id)
            : ""
          : activeTripId || "",
      );
      setError("");
    } catch (loadError) {
      console.error("Could not load AI chat history:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load assistant conversations.",
      );
    } finally {
      setLoadingHistory(false);
    }
  }, [activeTripId]);

  useEffect(() => {
    if (!accessToken) return undefined;
    const timerId = window.setTimeout(() => void loadChatData(), 0);
    return () => window.clearTimeout(timerId);
  }, [accessToken, loadChatData]);

  useEffect(() => {
    const openAssistant = () => setIsOpen(true);
    window.addEventListener(OPEN_ASSISTANT_EVENT, openAssistant);
    return () =>
      window.removeEventListener(OPEN_ASSISTANT_EVENT, openAssistant);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeMessages, busy]);

  function startNewConversation() {
    conversationIdRef.current = "";
    setConversationId("");
    setSelectedTripId(activeTripId || "");
    setDraft("");
    setError("");
  }

  function openConversation(conversation) {
    const id = String(conversation.id);
    conversationIdRef.current = id;
    setConversationId(id);
    setSelectedTripId(conversation.trip_id ? String(conversation.trip_id) : "");
    setError("");
  }

  async function closeAssistant() {
    if (busy || closing || loadingHistory) return;
    setClosing(true);
    setError("");
    try {
      const remainingConversations = [...conversations];
      const remainingMessages = [...messages];
      for (const conversation of conversations) {
        await aiConversationApi.remove(conversation.id);
        const id = String(conversation.id);
        const conversationIndex = remainingConversations.findIndex(
          (item) => String(item.id) === id,
        );
        if (conversationIndex !== -1) {
          remainingConversations.splice(conversationIndex, 1);
        }
        setConversations([...remainingConversations]);
        setMessages(
          remainingMessages.filter(
            (message) => String(message.conversation_id) !== id,
          ),
        );
      }
      conversationIdRef.current = "";
      setConversationId("");
      setConversations([]);
      setMessages([]);
      setDraft("");
      setSelectedTripId(activeTripId || "");
      setIsOpen(false);
    } catch (closeError) {
      console.error("Could not clear assistant chat history:", closeError);
      setError(
        closeError instanceof Error
          ? `Could not delete all chat history. ${closeError.message}`
          : "Could not delete all chat history. Please try again.",
      );
    } finally {
      setClosing(false);
    }
  }

  async function sendMessage(event) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    if (!accessToken) {
      setError("Sign in to use the Komsan assistant.");
      return;
    }
    setBusy(true);
    setError("");
    setDraft("");
    try {
      let id = conversationIdRef.current;
      if (!id) {
        if (!userId) {
          throw new Error("Your account is still loading. Please try again.");
        }
        const conversation = await aiConversationApi.create({
          user_id: userId,
          trip_id: selectedTripId ? Number(selectedTripId) : null,
          title: text.slice(0, 60),
        });
        id = String(conversation.id);
        conversationIdRef.current = id;
        setConversationId(id);
        setConversations((current) => [conversation, ...current]);
      }
      const selectedTripContext =
        String(selectedTripId) === String(activeTripId)
          ? tripContext
          : {
              trip: selectedTrip
                ? {
                    id: selectedTrip.id,
                    title: selectedTrip.name,
                    destination_id: selectedTrip.destination_id,
                    start_date: selectedTrip.start_date,
                    end_date: selectedTrip.end_date,
                    currency: selectedTrip.currency,
                  }
                : null,
              itinerary: [],
              budget: null,
              savedPlaces: [],
            };
      const contextualMessage = [
        `User request:\n${text}`,
        `Current trip context (JSON):\n${JSON.stringify(selectedTripContext)}`,
        "Only when the user explicitly requests an app change, respond with a JSON object such as {\"actions\":[{\"name\":\"add_itinerary_item\",\"arguments\":{\"tripId\":1,\"day\":1,\"title\":\"Visit\",\"time\":\"10:00:00\",\"cost\":12}}],\"message\":\"Added the visit.\"} and a short user-facing summary in \"message\". For greetings, questions, and travel advice, answer helpfully in normal plain text, never JSON, and never leave the reply empty. Supported action names: add_itinerary_item, update_budget, add_expense, add_reminder, end_trip. Do not invent IDs or claim an action succeeded unless it is in this JSON.",
      ].join("\n\n");
      const result = await aiMessageApi.send(id, contextualMessage);
      const reply = result.assistant_message?.message || "";
      const calls = extractToolCalls(reply);
      const actionResults = [];
      for (const call of calls) {
        if (!call.name) continue;
        const args = parseArguments(call.args) || {};
        if (selectedTripId) args.tripId = Number(selectedTripId);
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
        result.user_message,
        {
          ...result.assistant_message,
          role: "assistant",
          message: visibleReply,
          actions: actionResults.map((item) => item.name),
        },
      ]);
    } catch (sendError) {
      console.error("Komsan assistant request failed:", sendError);
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
          aria-label="Open Komsan AI assistant"
          className="fixed bottom-5 right-5 z-40 grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-transparent transition hover:scale-105 sm:h-32 sm:w-32"
          onClick={() => setIsOpen(true)}
          title="Open Komsan AI assistant"
          type="button"
        >
          <img
            alt="Komsan AI"
            className="tripos-chatbot-launcher-logo h-full w-full rounded-full object-cover"
            src={ChatbotLogo}
          />
        </button>
      )}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/30"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) void closeAssistant();
          }}
        >
          <section
            aria-label="Komsan AI assistant"
            aria-modal="true"
            className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
            role="dialog"
          >
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <img
                  alt=""
                  className="h-11 w-11 rounded-xl object-cover"
                  src={ChatbotLogo}
                />
                <div>
                  <h2 className="font-bold text-slate-950">Komsan AI</h2>
                  <p className="text-xs text-slate-500">
                    {selectedTrip?.name || "Travel assistant"}
                  </p>
                </div>
              </div>
              <button
                aria-label="Close assistant"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                disabled={busy || closing || loadingHistory}
                onClick={() => void closeAssistant()}
                type="button"
              >
                <X size={18} />
              </button>
            </header>
            <div className="border-b border-slate-100 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <History
                    aria-hidden="true"
                    className="shrink-0 text-slate-400"
                    size={16}
                  />
                  <span className="truncate text-xs font-semibold text-slate-500">
                    Chat history ({conversations.length})
                  </span>
                </div>
                <button
                  aria-label="Start new conversation"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-teal-800 hover:bg-teal-50"
                  onClick={startNewConversation}
                  title="New conversation"
                  type="button"
                >
                  <Plus aria-hidden="true" size={18} />
                </button>
              </div>
              {conversations.length > 0 ? (
                <nav
                  aria-label="Chat history"
                  className="mt-2 flex max-h-28 flex-col gap-1 overflow-y-auto"
                >
                  {conversations.map((conversation) => (
                    <button
                      aria-current={
                        String(conversation.id) === String(conversationId)
                          ? "true"
                          : undefined
                      }
                      className={`w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs ${
                        String(conversation.id) === String(conversationId)
                          ? "bg-teal-100 font-semibold text-teal-900"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                      key={conversation.id}
                      onClick={() => openConversation(conversation)}
                      title={conversation.title}
                      type="button"
                    >
                      {conversation.title}
                    </button>
                  ))}
                </nav>
              ) : (
                <p className="mt-2 text-xs text-slate-400">No saved chats yet.</p>
              )}
              <label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500">
                <MapPin aria-hidden="true" size={15} />
                <span>Trip context</span>
                <select
                  aria-label="Trip context"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-teal-600"
                  disabled={Boolean(
                    conversations.find(
                      (conversation) =>
                        String(conversation.id) === String(conversationId),
                    )?.trip_id,
                  )}
                  onChange={(event) => setSelectedTripId(event.target.value)}
                  value={selectedTripId}
                >
                  <option value="">No trip context</option>
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div
              aria-live="polite"
              className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4"
            >
              {loadingHistory && (
                <p
                  className="flex items-center gap-2 text-sm text-slate-500"
                  role="status"
                >
                  <LoaderCircle className="animate-spin" size={16} />
                  Loading your conversations…
                </p>
              )}
              {!loadingHistory && !activeMessages.length && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm leading-6 text-slate-600">
                  <MessageSquare
                    aria-hidden="true"
                    className="mb-2 text-teal-700"
                    size={19}
                  />
                  Ask about your trip or request an itinerary, budget, expense,
                  or reminder update. I’ll use the selected trip’s current data.
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      "Plan a 3-day trip",
                      "Suggest a relaxed itinerary",
                      "What should I pack?",
                    ].map((suggestion) => (
                      <button
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
                        key={suggestion}
                        onClick={() => setDraft(suggestion)}
                        type="button"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {activeMessages.map((message, index) => (
                <article
                  className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "ml-auto bg-teal-800 text-white"
                      : "border border-slate-100 bg-white text-slate-700"
                  }`}
                  key={message.id || `${message.role}-${index}`}
                >
                  {getVisibleMessage(message.message)}
                  {message.actions?.length > 0 && (
                    <p className="mt-2 border-t border-slate-100 pt-2 text-xs font-semibold text-emerald-700">
                      Updated: {message.actions.join(", ")}
                    </p>
                  )}
                </article>
              ))}
              {busy && (
                <div
                  aria-label="Komsan AI is thinking"
                  className="flex w-fit items-center gap-3 rounded-2xl rounded-bl-md border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500"
                  role="status"
                >
                  <span aria-hidden="true" className="tripos-thinking-dots">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="sr-only">Komsan AI is thinking</span>
                </div>
              )}
              <div ref={endRef} />
            </div>
            {error && (
              <p className="flex items-center justify-between gap-3 border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
                {error}
                <button
                  className="shrink-0 font-semibold underline"
                  onClick={() => {
                    if (draft.trim()) {
                      void sendMessage();
                      return;
                    }
                    setLoadingHistory(true);
                    void loadChatData();
                  }}
                  type="button"
                >
                  Retry
                </button>
              </p>
            )}
            <form className="flex gap-2 border-t border-slate-100 p-4" onSubmit={sendMessage}>
              <label className="sr-only" htmlFor="tripos-ai-message">
                Message Komsan AI
              </label>
              <textarea
                className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
                id="tripos-ai-message"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask Komsan AI…"
                rows={1}
                value={draft}
              />
              <button
                aria-label="Send message"
                className="self-end rounded-xl bg-teal-800 p-3 text-white disabled:opacity-50"
                disabled={busy || loadingHistory || !userId || !draft.trim()}
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
