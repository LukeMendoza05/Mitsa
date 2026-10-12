# Approved architecture diagrams

These describe the approved target architecture, not completed application modules. Generated with Archify 3.0.1 from typed JSON candidates. Every artifact passed showcase validation, deterministic delivery/provenance and automated real-browser checks. All six 1440×900 light-theme captures were visually inspected: labels, connectors, state exits and recovery order are readable with no overlapping nodes. Automated checks also cover dark theme and larger viewports; these additional captures were not separately visually inspected.

- [Architecture and trust boundaries](../.archify/architecture-foundation-20261012-133000/foundation.html)
- [Atomic checkout and recovery sequence](../.archify/sequence-checkout-recovery-20261012-135100/checkout-recovery.html)
- [Immutable sale/reversal lifecycle](../.archify/lifecycle-sale-20261012-134200/sale.html)
- [Order reservation lifecycle](../.archify/lifecycle-reservation-20261012-134200/reservation.html)
- [Delivery lifecycle](../.archify/lifecycle-delivery-20261012-134200/delivery.html)
- [Transfer lifecycle](../.archify/lifecycle-transfer-20261012-134200/transfer.html)

Each folder retains candidate.json, HTML and artifact-bound finalizer/browser receipts. Architecture has an advisory about leading whitespace; it passed all required gates. No update notice was required.

## Reviewed hosted authentication repair

- [Auth adapter trust boundary](../.archify/architecture-auth-adapter-20261012-165200/auth-adapter.html)

This additional Archify artifact describes the separately approved authentication design, including its postgres-owned read-only exception and the continuing non-bypass business boundary. It is a system-design diagram, not a repository-revision provenance claim. Showcase validation, delivery, strict checks and automated real-browser checks all passed with zero diagnostics. No screenshot capture or separate perceptual review was requested or claimed for this artifact; no update notice was required.
