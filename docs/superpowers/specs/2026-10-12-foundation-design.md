# Approved Foundation Architecture

Status: conditionally approved, 2026-10-12. Execution is authorized for Stage 1 Tasks 1–3 only. No product management, inventory operations, checkout, staff invitation feature, or live deployment is authorized at this checkpoint. Authentication/security proof uses synthetic identities and records only.

Hosted compatibility repair, 2026-10-12: Fire_Inv's operator cannot delegate managed Auth schema USAGE to the custom business roles. The user separately reviewed and approved the fixed, read-only `private.current_actor()` authentication adapter owned by postgres. It validates PostgREST request provenance, claim shape/expiry and current Auth user/session state, returning only UUID/null. This sole elevated authentication exception references no business tables and performs no mutations. Business helpers and commands retain their original non-bypass owners and FORCE RLS. No new managed-schema grants, role inheritance, or runtime administrative credential is used. Migration 20261012070606 was proven by rollback and then committed atomically with its history entry. Hosted behavioral acceptance is recorded in `docs/foundation-checkpoint.md`; Task 4 remains gated. All three release stages below remain in scope.

## Architecture and trust boundaries

Next.js App Router + TypeScript on Vercel; Supabase Auth + PostgreSQL. The browser is untrusted. Request-scoped server clients forward the authenticated user identity with a publishable API key. Private database commands enforce authorization, row locking, idempotency and atomicity. No ordinary runtime service-role/secret key. No Redis, queues, microservices or general command bus.

Use a server-only Supabase SSR integration: HttpOnly cookies, Secure in production, SameSite=Lax, explicit same-origin protection, verified claims and fresh user validation for sensitive routes. Database checks current session, active membership, role and assigned shops. No browser Auth SDK, localStorage, IndexedDB, persisted carts or persisted browser command payloads. Authenticated responses are private/no-store; refresh cookie chunks and cache headers must survive every response.

Public registration and anonymous authentication are disabled. Initial owner provisioning is an operator procedure. Invitation administration will run in a separately authorized Supabase Edge Function with credentials outside Next.js. Incomplete invitation onboarding grants no business access. Password recovery uses expiring single-use server callbacks with allowlisted destinations. Membership revocation preserves historical identity.

Only an API schema exposes scoped invoker reads and command wrappers. Private SECURITY DEFINER commands use an empty fixed search_path and qualified names. A custom NOLOGIN NOBYPASSRLS command role does not own tables. FORCE RLS applies to private business tables. A narrowly granted authorization-helper role avoids recursive membership policies. Revoke default PUBLIC/anon execution and direct authenticated DML. Separate cost/profit data from cashier-readable records. Prove this arrangement on hosted Supabase before building domain features.

## Non-negotiable invariants

- Never accept client roles, costs, rates, discount approvals or final payable totals as authority.
- No business transaction partially commits. Unexpected failures remain unconfirmed until checked.
- Available stock = on_hand - reserved; enforce on_hand >= reserved >= 0 for every operation.
- Finalized business records remain immutable. Corrections are linked reversal documents and movements.
- Reconcile immutable histories with quantity, valuation, financial and cash projections in one consistent snapshot.
- All monetary arithmetic is exact decimal; APIs carry decimal strings.
- Never connect destructive tooling to production or unrelated projects; never deploy this checkpoint live.

## Approved decisions

1. Ordinary product/unit/bundle/price management is owner-only. Managers approve order-specific discounts and cannot edit standard prices.
2. Staff invitations use a separately authorized Supabase Edge Function; its administrative credential never enters browser or ordinary application runtime.
3. One accountable cashier per shift. Every cash movement records acting employee, responsible drawer and accountable cashier.
4. Owner-entered exact-date exchange rates only. No automatic carry-forward. Rate 1 is valid only when transaction and reporting currencies match.
5. Currency conversion rounding adjustments must be bounded, displayed and mathematically reconciled. The exact maximum/policy remains gated before foreign-currency implementation.

## Schema blueprint and migration stages

All business records carry business_id; shop records carry shop_id. Composite foreign keys prohibit cross-business or inconsistent shop references. Runtime monetary amounts use numeric(24,6), rates numeric(30,12), valuation numeric(38,12). Currency minor-unit precision governs final rounding. Reporting currency is fixed after the first posting.

| Area | Planned records |
|---|---|
| Access | businesses, shops, memberships, shop_assignments, staff_invitations, invitation_events |
| Catalog | products, selling_unit_versions, bundle_component_versions, shop_price_versions; separate cost data |
| Currency | currencies, business_currency_settings, dated_rate_versions, immutable rate_snapshots |
| Inventory | locations, stock_balances, valuation_balances, immutable movements and valuation_entries |
| Orders | customer_orders, order_lines, component_allocations, order_events, reservations, reservation_allocations, deliveries |
| Recovery | checkout_sessions, sealed checkout_attempt payloads, immutable command_results and lifecycle events |
| Sales | sales, sale_lines, issued_components, cost_snapshots, receipt_identifiers, reversal_documents |
| Finance | payments, tender/change records, allocations, deposits, credit_notes, customer_account_entries, settlement_entries |
| Cash | shifts, per-currency totals, cash_movements, closing_counts, discrepancy_reviews |
| Purchasing | suppliers, purchase_orders/lines, receipts/lines, obligations, supplier_payments/allocations |
| Transfers | transfer_headers/lines, dispatch/receipt events, transit allocations, discrepancies |
| Stage 3 | return_documents/lines/dispositions, refunds, quarantine/writeoffs, expenses |
| Audit | immutable actor, shop, command, reason, record references and timestamp; no credentials/tokens |

Migration checkpoints: foundation security proof; Stage 1 slice; remaining Stage 1; Stage 2 purchasing/fulfilment; Stage 3 returns/reporting. Later modules are schema plans only until authorized. Migrations are version controlled, additive, validated and forward compatible. Never rewrite history or destructively roll back posted business events.

## Inventory and costing

Integer base components support individual pieces, packs, cartons and fixed bundles. Aggregate repeated components across every order line before locking. Authorized intake creates zero projection rows before deterministic sorted locks; checkout never creates missing stock. Ledger effects must update exactly one projection row.

Maintain moving weighted-average cost per shop in business reporting currency. Final-unit issues absorb remaining valuation residual. Purchase receipt costs use receipt-date FX; later supplier-payment FX does not change stock cost. Transfers move exact source cost through transit and into destination average, without using shop tender currencies. Sellable returns restore original issued cost. Non-sellable returns enter quarantine, never available stock. Inspection promotion/writeoff is explicit. Old receipt corrections use a safe current-cost issue rule with explicit variance; they cannot produce negative value after intervening sales.

## Orders and fulfilment

The customer order owns commercial terms. Its single reservation owns all base-component holds. Confirmed order lines freeze unit/bundle versions and agreed prices, not a future sale's reporting rates. Quotes do not hold stock. One private fulfil_order operation serves direct checkout, pickup and dispatch. Unique order fulfilment and sale/order relationships prevent duplicate deductions. Consumption changes on_hand and reserved together. Delivery completion/retry does not deduct stock again. Version one fulfils whole orders only; purchase receipts may be partial. Deposits remain liabilities until applied, with no second cash receipt.

## Checkout command and recovery

One server workspace per actor/shop; revision conflicts reject stale tab edits. Preparation seals the order revision and persists a server-generated attempt/key and canonical payload. Atomic checkout commits sale, movements, payment, finance, audit and outcome together. Refresh and lost-response recovery read the authorized server attempt. Missing results mean unconfirmed, not failure. Resume reuses the same attempt. Cancellation uses that attempt's stored identity/hash and common command lock: cancellation wins before posting or returns the committed result. New sale requires an explicit new order after the prior attempt resolves.

Global locking order: membership; command identity; workspace/attempt; order and ranked workflow documents; quote/catalog references; shifts/account balances; sorted stock rows; valuation projections. Replay recorded outcomes before quote-expiry checks. Same key/different hash rejects; unique order/quote prevents another key selling twice. Expected business rejection rolls back business effects in a subtransaction and records rejection. Unknown exceptions roll back everything.

## Currency, credit and cash

The first slice is fully paid cash in reporting currency only. Remaining Stage 1 adds multi-currency and split cash/manual digital payments. Use exact dated owner rates and immutable snapshots; refunds preserve original net tender currencies and original payment snapshots. Same-currency cash change only. Reject digital overpayment. Five-minute quotes refresh at the business-date boundary. Receipts use receipt-date FX; sales use posting/fulfilment date; collections use collection date. Separate historical receivable value, current allocation value and actual tender value: their differences explicitly reconcile FX and rounding. Final foreign-tender rounding policy remains an implementation gate.

Credit requires a named customer, manager approval bound to order revision/maximum/due date. Lock accounts/allocations to prevent over-allocation. Outstanding and overdue reporting derive from immutable entries. Deposits and repayments use the same explicit allocation model.

Expected cash per currency = opening float + receipts - change - refunds + paid-in - paid-out. Never offset different currencies. Every cash event requires an authorized open shift and locks against closing. Closed counts are immutable; reviews append explanations. Refunds after closure use a current authorized shift, not an old shift rewrite.

## Reversal

Owner/assigned manager full-sale reversal requires reason and original receipt linkage. Initial slice requires fully paid cash and all goods verified sellable. Atomically restore original components and issued value, reverse revenue/COGS, refund original net payment excluding change, record current-shift cash and audit. Unique full reversal plus idempotency prevents a second reversal. Remaining Stage 1 extends full reversals to split/credit settlements with original snapshots; Stage 3 owns ordinary partial/full customer returns.

## Permissions

| Capability | Owner | Assigned manager | Assigned cashier |
|---|---|---|---|
| Staff/role/shop/revocation | Yes | No | No |
| Currency/rate configuration | Yes | No | No |
| Catalog and ordinary prices | Yes | No | No |
| Discount/credit approval | Yes | Yes | No |
| Basic customer create/search | Yes | Yes | Yes |
| Checkout/collections/repayments | Yes | Yes | Yes, approved balances |
| Reservations/deposits/delivery status | Yes | Yes | Yes |
| Reversals/refunds/returns | Yes | Yes | No |
| Suppliers/purchases/receiving | Yes | Yes | No |
| Transfers | Yes | Both shops assigned | No |
| Costs/profit/financial CSV | All shops | Assigned shops | No |
| Own shift | Yes | Yes | Yes |
| Discrepancy review/paid-in/out | Yes | Yes | No |
| Combined reporting | All shops | Assigned aggregate | No |

## Business state machines

| Record | Allowed lifecycle |
|---|---|
| Checkout session | editing -> sealed -> completed; confirmed rejection permits a new revision/attempt |
| Attempt | prepared -> committed/rejected; cancellation is a rejection; unconfirmed is observational |
| Order | draft -> confirmed -> fulfilled; direct checkout draft -> fulfilled atomically; unfulfilled -> cancelled |
| Reservation | draft -> active -> consumed/cancelled/expired |
| Sale | posted immutable; linked records derive partly-reversed/reversed |
| Payment | unpaid -> partially-paid -> paid, derived from allocations/credits |
| Delivery | pending -> dispatched -> delivered; pending cancellation; failed dispatch retries without deduction or linked return |
| Transfer | draft -> dispatched -> received; discrepancy -> resolved receipt; linked correction after dispatch |
| Shift | open -> closed -> reviewed; append discrepancy explanation |

Reversed fulfilled orders cannot be fulfilled again; replacements need new orders.

## Verification and release gates

Unit tests plus real PostgreSQL/JWT tests and built-app Playwright desktop/mobile tests. Cover last-unit races, repeated bundle components, duplicate payload/key requests, lost responses, stale tabs, cancellation races, rollback at stock/finance/audit, exact rounding, stock constraints, role/shop/session revocation, malicious direct RPC/table access, historical reversals, cash close races and consistent reconciliation. Extend in later stages for FX/credit, deposits/transfers/purchases and returns/profit/CSV formula escaping.

Required commands: npm run test (aggregate), npm run test:e2e, npm run build, npm run typecheck, npm run test:integration, npm run db:reconcile and native dependency audit. No skipped hosted tests count as passing. Before any live pilot, prove backup restoration into an isolated environment, including balances, grants/RLS/functions and authentication.

## Configuration and remaining gates

Confirm reporting/accepted currencies, business timezone, shops, initial owner, production email delivery and backup arrangements before live use. Hosted roles/grants/RLS and server-only SSR compatibility must pass real tests before domain implementation. Exact foreign-currency rounding policy must be finalized/tested before foreign payments. No service-role fallback is authorized.
