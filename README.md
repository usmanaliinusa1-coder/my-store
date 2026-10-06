# MY STORE (through Phase 5: checkout, orders, Paystack)

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env`, fill every value (see the file for which are public and which are server-only).
3. Run all migrations `supabase/migrations/001`..`006` in the Supabase SQL editor, in order.
4. Browse only (no payments): `npm run dev` -> http://localhost:5173
5. With payments: `npm run dev:netlify` (serves the site AND `/.netlify/functions/*`) -> http://localhost:8888
   (Paystack cannot reach `localhost` webhooks; for the webhook use a deployed site or a tunnel such as `ngrok http 8888`.)

## Payment architecture (Phase 5)
- Browser: `create_order()` (Postgres RPC) -> order stored as pending/pending, stock reserved. Prices/totals are ALWAYS computed in the database.
- `netlify/functions/paystack-initialize.ts`: loads the order, uses `orders.total_amount` as the amount, calls Paystack with the secret key, returns the payment page URL.
- `netlify/functions/paystack-verify.ts`: called by `/payment/callback`; asks Paystack, checks reference + currency + amount, then `mark_order_paid()`.
- `netlify/functions/paystack-webhook.ts`: HMAC-SHA512 signature check, then the same idempotent settlement.
- `netlify/functions/order-cancel.ts`: lets a customer cancel THEIR unpaid order (releases stock).
- Only `mark_order_paid()` / `mark_payment_failed()` (service role only) can change payment state.

## Environment variables
| Variable | Where | Public? |
|---|---|---|
| VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_PAYSTACK_PUBLIC_KEY | local `.env` + Netlify | yes (browser) |
| PAYSTACK_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, SITE_URL | Netlify (Functions scope) + local `.env` for `netlify dev` | NO, server only |

The full README (all deployment steps) is written in the final phase.
