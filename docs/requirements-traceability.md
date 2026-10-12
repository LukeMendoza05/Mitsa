# First-release traceability

All three stages belong to the first release. Stage 1A denotes the first slice; Stage 1B denotes remaining Stage 1 work, not a fourth release stage.

| Requirement | Stage | Acceptance evidence when authorized |
|---|---|---|
| Owner provisioning, invite-only staff, recovery, roles/shops/revocation | 1 | Auth/JWT/RLS lifecycle tests |
| Products, individual/pack/carton/bundle versions, owner-only standard prices | 1 | Catalog permissions and repeated-component tests |
| Opening stock, immutable movement/value ledgers, shop weighted average | 1 | Real database projection reconciliation |
| Fully paid single-currency cash checkout and receipt | 1A | Concurrent checkout + desktop/mobile receipt E2E |
| Lost response/refresh recovery without persisted browser business state | 1A | Prepared/committed response-loss and duplicate tests |
| Manager full-sale reversal and original receipt links | 1A, extended 1B | Original quantity/cost/net payment, atomic replay tests |
| Multi-currency/split cash/manual digital payments | 1B | Currency allocation and tender tests |
| Exact-date owner rates, snapshots, rounding, FX differences | 1B | Missing-rate rejection and exact entry reconciliation |
| Same-currency change and original-currency/rate reversals | 1B | Historical snapshots and split refund tests |
| Credit approvals/due dates/repayments/outstanding/overdue | 1B | Revision approvals, concurrent allocation and reporting tests |
| Shop low-stock alerts | 1 | Threshold and assigned-shop tests |
| Customer search/create | 1 | Scope and search tests |
| Cash shifts, expected/count per currency, discrepancies | 1A minimal, 1B full | Cash ledger/count/review tests |
| Shop sales/stock/cash/customer CSV | 1 | Scoped output and formula-escaping tests |
| Suppliers and supplier search | 2 | Assigned-shop access and search tests |
| Purchase orders, partial receiving, supplier balances/payments | 2 | Atomic receiving, FX costing and obligation reconciliation |
| Transfers with transit costing and receipt discrepancies | 2 | Concurrent stock and source/destination valuation tests |
| Customer orders, full reservations, deposits and pickup | 2 | Hold ownership, single consumption and deposit liability tests |
| Delivery orders/status/retry | 2 | Dispatch/pickup race and no double deduction |
| General full/partial customer returns and original-currency refunds | 3 | Refund caps, original snapshots and residual allocation |
| Sellable returns versus quarantine/inspection/writeoff | 3 | Availability and original-cost disposition tests |
| Expenses | 3 | Authorized payment, shift and reporting reconciliation |
| Combined shop reports, inventory history, best sellers and operational profit | 3 | Scoped aggregates, FX/cost/expense reports and CSV |
| Exact decimals, immutable records, linked corrections/audit | Every stage | Numeric/security/invariant suites |
| Desktop/tablet/mobile and online-only operation | Every stage | Responsive E2E and unconfirmed-failure UI |
| Real PostgreSQL concurrency/security, aggregate test/build gates | Every stage | Fresh recorded command outputs |
| Verified backup restoration before live use | Pre-live gate | Isolated restore evidence |

Excluded: offline queues, payment gateway processing, full statutory accounting/tax, wholesale and driver-dispatch optimization. This checkpoint implements Tasks 1–3 only and does not complete Stage 1A.
