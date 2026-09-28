# Store account

This folder contains store-account-specific state and helpers. Store users use
the backend role `storeman`; they can receive warehouse and quarry deliveries,
inspect every material against the MRF, and accept or reject a delivery.

Account credentials and site assignment belong in the backend user directory
and must not be committed to the mobile app. Configure the account through the
management Users screen or the backend account-management endpoint.
