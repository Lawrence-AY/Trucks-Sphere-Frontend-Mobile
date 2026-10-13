# Store account

This folder contains store-account-specific state and helpers. Store users use
the backend role `storeman`; they can receive warehouse and quarry deliveries,
inspect every material against the MRF after receiving it.

Receiving records each material's count and photo, the initial condition, the
delivery personnel, and the authenticated receiver and timestamp. A failed
condition requires a reason and ends the store workflow as `receiving_rejected`.
A passed receipt becomes `received_pending_inspection` and appears in Inspection.
The immutable receipt and its photos remain available in that job's detail view.

Quality approval requires all general metrics. The backend atomically saves the
decision and stock projection, then marks `receivingStatus` as `inventory_added`.
Quality failures become `inspection_rejected`. Both rejection states retain a
`receivingFlag` and appear under History → Flagged, with no available inventory.
These receiving states are independent of the existing truck `status` field.

New actions use `/api/delivery-orders/:id/store-receiving` and `store-inspection`.
Evidence is uploaded to `/api/uploads/receiving-photo/:id?lineIndex=0` before
intake is submitted. The server seals the photos and quantities after receiving.
Request IDs make retries idempotent. Ordinary delivery updates cannot set these
states or bypass approval, and manual stock receipts cannot bypass the workflow.

Existing finalized inspections remain historical records; bulk weighbridge
receiving continues through its existing flow. No collection migration is needed.

Account credentials and site assignment belong in the backend user directory
and must not be committed to the mobile app. Configure the account through the
management Users screen or the backend account-management endpoint.
