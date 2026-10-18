# API service

Add the shared HTTP client, request defaults, and endpoint modules here. Keep authentication secrets on the server and avoid calling APIs directly from UI components.

The resource API modules use the authenticated `/api/v1` endpoints for budgets,
budget categories, expenses, trip wallets, wallet transactions, and wallets.
Each module's default export provides `list`, `getById`, `create`, `update`,
and `remove` methods. Updates use `PATCH`; deletes return `true` for the
backend's `204 No Content` response. Entity-specific named helpers are also
exported from each module. Wallet expenses can continue using the compatibility
methods in `walletapi.js` (`fetchWalletData`, `createWallet`, and so on).
The budget screen signs in through `/auth/login`; the access token is stored
under `accessToken`, attached to protected requests, and cleared after an
unauthorized response or explicit sign-out.

Additional authenticated modules cover notifications, reminders, AI
conversations and messages, trips, and place photos. Place-photo routes support
list, get, create, and delete; the backend does not currently expose a
place-photo update route.

The saved-place API uses the authenticated `/saved-places` endpoint. The Saved
Places screen joins saved-place records with `/places`; hearts are shown only
for persisted places because destinations and Wikipedia search results are
not accepted by the saved-place API.

The account profile uses the authenticated `/users/me` endpoint to read the
signed-in user's name, email, and profile text. Profile edits are sent as a
`PATCH` to `/users/me`; email remains read-only in the current profile UI.
Profile photos are uploaded as multipart data to `/users/me/avatar` and served
from a generated avatar URL.