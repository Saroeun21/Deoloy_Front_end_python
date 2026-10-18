import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LoaderCircle,
  MapPin,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import { apiRequest } from "../../services/api/httpClient.js";
import aiConversationApi from "../../services/api/ai_conversation_api.js";
import aiMessageApi from "../../services/api/ai_message_api.js";
import tripApi from "../../services/api/tripapi.js";
import { useAuth } from "../../app/providers/authContext.js";

function messageTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function AIAssistant() {
  const { accessToken } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [trips, setTrips] = useState([]);
  const [userId, setUserId] = useState(null);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const selectedConversationRef = useRef("");
  const [selectedTripId, setSelectedTripId] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endOfMessagesRef = useRef(null);

  const loadChatData = useCallback(async () => {
    try {
      const [conversationData, messageData, tripData, user] = await Promise.all([
        aiConversationApi.list(),
        aiMessageApi.list(),
        tripApi.list(),
        apiRequest("/users/me"),
      ]);
      setError("");
      setConversations(conversationData);
      setMessages(messageData);
      setTrips(tripData);
      setUserId(user.id);

      const selected =
        conversationData.find(
          (item) =>
            String(item.id) === String(selectedConversationRef.current),
        ) || conversationData[0];
      const selectedId = selected ? String(selected.id) : "";
      selectedConversationRef.current = selectedId;
      setSelectedConversationId(selectedId);
      setSelectedTripId(selected?.trip_id ? String(selected.trip_id) : "");
    } catch (loadError) {
      console.error("Could not load AI chat data:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the assistant.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accessToken) void loadChatData();
  }, [accessToken, loadChatData]);

  const selectedConversation = conversations.find(
    (item) => String(item.id) === String(selectedConversationId),
  );
  const activeMessages = useMemo(
    () =>
      messages
        .filter(
          (item) =>
            String(item.conversation_id) === String(selectedConversationId),
        )
        .sort(
          (left, right) =>
            new Date(left.created_at).getTime() -
            new Date(right.created_at).getTime(),
        ),
    [messages, selectedConversationId],
  );

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, sending]);

  function startNewConversation() {
    selectedConversationRef.current = "";
    setSelectedConversationId("");
    setSelectedTripId("");
    setDraft("");
    setError("");
  }

  function openConversation(conversation) {
    selectedConversationRef.current = String(conversation.id);
    setSelectedConversationId(String(conversation.id));
    setSelectedTripId(conversation.trip_id ? String(conversation.trip_id) : "");
    setError("");
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    if (!userId) {
      setError("Sign in to chat with the travel assistant.");
      return;
    }

    setSending(true);
    setError("");
    setDraft("");
    try {
      let conversationId = selectedConversationId;
      if (!conversationId) {
        const conversation = await aiConversationApi.create({
          user_id: userId,
          trip_id: selectedTripId ? Number(selectedTripId) : null,
          title: text.slice(0, 60),
        });
        conversationId = String(conversation.id);
        selectedConversationRef.current = conversationId;
        setSelectedConversationId(conversationId);
        setConversations((current) => [conversation, ...current]);
      }

      const result = await aiMessageApi.send(conversationId, text);
      setMessages((current) => [
        ...current,
        result.user_message,
        result.assistant_message,
      ]);
    } catch (sendError) {
      console.error("Could not send AI chat message:", sendError);
      setDraft(text);
      setError(
        sendError instanceof Error
          ? sendError.message
          : "The assistant could not send a reply.",
      );
    } finally {
      setSending(false);
    }
  }

  if (!accessToken) {
    return (
      <main className="flex min-h-full items-center justify-center bg-slate-50 p-6">
        <section className="max-w-md rounded-2xl bg-white p-7 text-center shadow-sm ring-1 ring-slate-200">
          <Sparkles className="mx-auto text-indigo-600" size={32} />
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            Sign in to chat
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Your conversations are private to your Komsan account.
          </p>
          <a
            className="mt-5 inline-flex rounded-xl bg-teal-800 px-5 py-3 text-sm font-semibold text-white"
            href="/budget"
          >
            Sign in
          </a>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-full items-center justify-center bg-slate-50 p-6 text-sm text-slate-500">
        <LoaderCircle className="mr-2 animate-spin" size={18} />
        Loading your conversations…
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-800 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 lg:min-h-[calc(100dvh-3rem)] lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-slate-50/80 p-4 lg:w-72 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <Sparkles size={20} />
            </span>
            <div>
              <h1 className="font-bold text-slate-900">Komsan Assistant</h1>
              <p className="text-xs text-slate-500">Travel planning chat</p>
            </div>
          </div>

          <button
            className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
            onClick={startNewConversation}
            type="button"
          >
            <Plus size={17} />
            New conversation
          </button>

          <div className="mt-6 min-h-0 flex-1">
            <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Recent conversations
            </p>
            <nav
              aria-label="Recent conversations"
              className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-y-auto"
            >
              {conversations.map((conversation) => {
                const active =
                  String(conversation.id) === String(selectedConversationId);
                return (
                  <button
                    aria-current={active ? "page" : undefined}
                    className={`flex min-w-52 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition lg:min-w-0 ${
                      active
                        ? "bg-indigo-100 font-semibold text-indigo-900"
                        : "text-slate-600 hover:bg-white"
                    }`}
                    key={conversation.id}
                    onClick={() => openConversation(conversation)}
                    type="button"
                  >
                    <MessageCircle className="shrink-0" size={16} />
                    <span className="truncate">{conversation.title}</span>
                  </button>
                );
              })}
              {conversations.length === 0 && (
                <p className="px-2 py-3 text-sm text-slate-400">
                  No conversations yet.
                </p>
              )}
            </nav>
          </div>
          <p className="mt-4 hidden text-xs leading-5 text-slate-400 lg:block">
            Travel suggestions are AI-generated. Confirm important details
            before booking.
          </p>
        </aside>

        <section
          aria-label="Travel assistant conversation"
          className="flex min-h-[70dvh] min-w-0 flex-1 flex-col lg:min-h-0"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-7">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-indigo-600">
                AI travel assistant
              </p>
              <h2 className="mt-1 truncate font-bold text-slate-900">
                {selectedConversation?.title || "Plan your next adventure"}
              </h2>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <MapPin size={15} />
              <span className="sr-only">Trip context</span>
              <select
                aria-label="Trip context"
                className="max-w-44 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
                disabled={Boolean(selectedConversation)}
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
          </header>

          {error && (
            <div
              className="mx-5 mt-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-7"
              role="alert"
            >
              <span>{error}</span>
              <button
                className="shrink-0 font-semibold underline"
                onClick={() => void loadChatData()}
                type="button"
              >
                Retry
              </button>
            </div>
          )}

          <div
            aria-live="polite"
            className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-7"
          >
            {activeMessages.length === 0 && (
              <div className="mx-auto mt-8 max-w-xl text-center sm:mt-16">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <Sparkles size={25} />
                </span>
                <h3 className="mt-5 text-xl font-bold text-slate-900">
                  What can I help you plan?
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Ask for destination ideas, itineraries, packing advice, or
                  help planning around your trip.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {[
                    "Plan a 3-day city trip",
                    "What should I pack?",
                    "Suggest a relaxed itinerary",
                  ].map((suggestion) => (
                    <button
                      className="rounded-full border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
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

            {activeMessages.map((message) => {
              const isUser = message.role === "user";
              return (
                <article
                  className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                  key={message.id}
                >
                  {!isUser && (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                      <Sparkles size={16} />
                    </span>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[75%] ${
                      isUser
                        ? "rounded-br-md bg-indigo-600 text-white"
                        : "rounded-bl-md bg-slate-100 text-slate-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-6">
                      {message.message}
                    </p>
                    <time
                      className={`mt-1 block text-right text-[10px] ${
                        isUser ? "text-indigo-100" : "text-slate-400"
                      }`}
                    >
                      {messageTime(message.created_at)}
                    </time>
                  </div>
                </article>
              );
            })}
            {sending && (
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                  <Sparkles size={16} />
                </span>
                <span className="flex items-center gap-2">
                  <LoaderCircle className="animate-spin" size={15} />
                  Thinking…
                </span>
              </div>
            )}
            <div ref={endOfMessagesRef} />
          </div>

          <form
            className="border-t border-slate-100 bg-white p-4 sm:px-7 sm:py-5"
            onSubmit={sendMessage}
          >
            {!selectedConversation && (
              <p className="mb-2 text-xs text-slate-400">
              {selectedConversation
                ? "This conversation keeps its selected trip context."
                : selectedTripId
                ? "Your selected trip will be attached to this conversation."
                : "Choose a trip above to give the assistant trip context."}
              </p>
            )}
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
              <label className="sr-only" htmlFor="assistant-message">
                Message the travel assistant
              </label>
              <textarea
                className="max-h-36 min-h-11 flex-1 resize-y bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400"
                id="assistant-message"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Ask anything about your trip…"
                rows={1}
                value={draft}
              />
              <button
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!draft.trim() || sending}
                type="submit"
              >
                {sending ? (
                  <LoaderCircle className="animate-spin" size={17} />
                ) : (
                  <Send size={17} />
                )}
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              AI can make mistakes. Verify time-sensitive travel details.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

export default AIAssistant;
