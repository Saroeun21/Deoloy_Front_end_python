# Komsan Project Structure

This blueprint organizes the Komsan frontend by product feature. The current workspace is a Vite + React frontend, so backend APIs and third-party integrations are represented as service boundaries rather than implemented server folders.

## Target folder tree

```text
src/
|-- app/
|   |-- App.jsx                    # App composition and route outlet
|   |-- routes.jsx                 # URL-to-page mapping and route guards
|   |-- navigation.js              # Sidebar groups and labels
|   |-- providers/
|   |   |-- AppProviders.jsx       # Application-wide providers
|   |   `-- AuthProvider.jsx       # Signed-in user and role
|   `-- layout/
|       |-- AppShell.jsx           # Sidebar, top bar, responsive content area
|       `-- AdminShell.jsx         # Admin-only navigation and layout
|
|-- features/
|   |-- discovery/
|   |   |-- pages/HomePage.jsx     # Home & destination discovery
|   |   |-- pages/ExplorePage.jsx  # Search and filter destinations
|   |   |-- pages/PlacePage.jsx    # Place details, save, add to trip
|   |   `-- components/
|   |       |-- DestinationCard.jsx
|   |       `-- PlaceFilters.jsx
|   |
|   |-- trips/
|   |   |-- pages/TripsPage.jsx    # My Trips dashboard
|   |   |-- pages/CreateTripPage.jsx
|   |   |-- pages/TripOverviewPage.jsx
|   |   |-- components/TripCard.jsx
|   |   `-- model/                 # Trip state, selectors, and mutations
|   |
|   |-- itinerary/
|   |   |-- pages/ItineraryPage.jsx
|   |   |-- components/DayTimeline.jsx
|   |   `-- components/WaypointRow.jsx
|   |
|   |-- budget/
|   |   |-- pages/BudgetPage.jsx   # Budget, wallet, expenses, settlements
|   |   |-- components/BudgetSummary.jsx
|   |   |-- components/ExpenseForm.jsx
|   |   `-- components/GroupLedger.jsx
|   |
|   |-- readiness/
|   |   |-- pages/PreparationPage.jsx
|   |   |-- pages/DocumentVaultPage.jsx
|   |   |-- pages/ScreenshotParserPage.jsx
|   |   |-- components/PackingChecklist.jsx
|   |   `-- components/DocumentCard.jsx
|   |
|   |-- assistant/
|   |   |-- pages/AssistantPage.jsx
|   |   |-- components/ChatPanel.jsx
|   |   `-- model/                 # Conversation state and prompt context
|   |
|   |-- memories/
|   |   |-- pages/MemoriesPage.jsx
|   |   |-- components/JournalEntry.jsx
|   |   |-- components/SmartReel.jsx
|   |   `-- components/TripSuperlatives.jsx
|   |
|   |-- analytics/
|   |   |-- pages/TripAnalyticsPage.jsx
|   |   |-- components/SpendBreakdown.jsx
|   |   |-- components/ActivityChart.jsx
|   |   `-- components/SettlementSummary.jsx
|   |
|   |-- profile/
|   |   |-- pages/ProfileSettingsPage.jsx
|   |   |-- components/TravelPreferencesForm.jsx
|   |   `-- components/IntegrationsList.jsx
|   |
|   `-- admin/
|       |-- pages/AdminDashboardPage.jsx
|       |-- components/PlatformHealth.jsx
|       |-- components/ReviewQueue.jsx
|       `-- components/ParserDistribution.jsx
|
|-- entities/
|   |-- trip/                       # Shared trip model and trip UI primitives
|   |-- place/                      # Destination/place model
|   |-- traveler/                   # Profile and companion model
|   |-- expense/                    # Expense and settlement model
|   `-- document/                   # Uploaded and parsed document model
|
|-- shared/
|   |-- components/                 # Buttons, fields, dialogs, tables, charts
|   |-- hooks/                      # Reusable non-feature-specific hooks
|   |-- lib/                        # Formatting, validation, date/currency helpers
|   `-- styles/                     # Tokens, reset, responsive utilities
|
|-- services/
|   |-- api/                        # HTTP client and endpoint modules
|   |-- ai/                         # Assistant and smart-reel API adapters
|   |-- currency/                   # Exchange-rate provider
|   |-- documents/                  # OCR/parser provider
|   |-- wallet/                     # Apple/Google Wallet adapters
|   `-- export/                     # Sanitized PDF/report generation
|
|-- data/demo/                      # Seed data for local development
|-- assets/                         # Local images, icons, and fonts
|-- main.jsx
`-- index.css

tests/
|-- unit/                           # Helpers, selectors, and component behavior
`-- e2e/                            # Main traveler and admin workflows
```

## Product route map

| Route | Screen | Feature |
| --- | --- | --- |
| `/` | Home & Discovery | `discovery` |
| `/explore` | Explore destinations | `discovery` |
| `/places/:placeId` | Place details | `discovery` |
| `/trips` | My Trips dashboard | `trips` |
| `/trips/new` | Create Trip wizard | `trips` |
| `/trips/:tripId` | Trip overview | `trips` |
| `/trips/:tripId/itinerary` | Itinerary timeline | `itinerary` |
| `/trips/:tripId/budget` | Budget & wallet | `budget` |
| `/trips/:tripId/prepare` | Packing & departure checklist | `readiness` |
| `/trips/:tripId/documents` | Travel document vault | `readiness` |
| `/trips/:tripId/screenshots` | AI screenshot vault & parser | `readiness` |
| `/assistant` | AI Travel Assistant | `assistant` |
| `/trips/:tripId/memories` | Trip memories & journal | `memories` |
| `/trips/:tripId/analytics` | Trip summary & analytics | `analytics` |
| `/profile` | User profile | `profile` |
| `/admin` | Admin mission control | `admin` (admin role required) |

## Ownership rules

- A feature owns its pages, feature-specific components, state, and API calls. Keep a page focused on composing components rather than implementing every interaction inline.
- Put UI used by several features in `shared/components`; put shared business entities in `entities`.
- Keep demo fixtures in `data/demo` and swap them for service results through feature model/API modules. Components should not import demo fixtures directly once real APIs are connected.
- Keep credentials and provider-specific network code out of React components. Integrations belong behind `services/*` adapters.
- Protect `/admin` with an authorization check; hiding its navigation item is not sufficient access control.
- Keep trip data scoped by `tripId`. Do not store unrelated profile, admin, and conversation state in one global trip context.

## Mapping from the current workspace

The current implementation is intentionally simpler and can remain in place while the structure is introduced incrementally:

| Current file | Target location |
| --- | --- |
| `src/App.jsx` | `src/app/App.jsx` |
| `src/components/Sidebar.jsx`, `src/components/TopBar.jsx` | `src/app/layout/` |
| `src/pages/Dashboard.jsx`, `src/pages/Explore.jsx` | `src/features/discovery/pages/` |
| Trip, itinerary, budget, preparation, and assistant views in `src/pages/TripWorkspace.jsx` | Split across `trips`, `itinerary`, `budget`, `readiness`, and `assistant` |
| Memories, analytics, profile, and admin views in `src/pages/PhaseFour.jsx` | Split across `memories`, `analytics`, `profile`, and `admin` |
| `src/context/` | Move state into the owning feature models; keep only cross-cutting providers in `src/app/providers/` |
| `src/data/tripData.js` | Split fixtures into `src/data/demo/` by domain |
| `src/App.css`, `src/index.css` | Shared tokens/base styles plus feature-local styles where useful |

## Suggested build order

1. Establish `app/layout`, route definitions, shared navigation, and demo data.
2. Complete Discovery and Trips: destinations, place details, trip creation, trip overview.
3. Add itinerary, budget, and group settlement workflows.
4. Add preparation, document vault, screenshot parsing, and the travel assistant.
5. Add memories and analytics using completed trip data.
6. Add profile preferences and integrations, then the role-protected admin dashboard.
7. Add unit tests for business rules and end-to-end coverage for trip creation, preparation, and post-trip review.