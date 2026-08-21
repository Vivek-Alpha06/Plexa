# Plexa Protocol Changelog

## Mainnet Release v1.0.0 (2026-08-22)

- refactor(contracts): verify memory safety and zero-copy data structures
- perf(group): minimize WASM export table footprint for lower rent cost
- feat(group): ensure permissionless group settlement idempotency
- feat(group): streamline member vote tally mathematical resolution
- refactor(factory): optimize salt generation for deterministic deployer
- feat(factory): enhance group registry query methods get_public_groups
- docs(contracts): document Soroban SDK v2 spec shaking optimizations
- test(contracts): add verification assertions for group deployment parameters
- feat(scripts): add resource fee simulation before Mainnet broadcast
- refactor(scripts): implement exponential backoff for transaction confirmation polling
- feat(scripts): add automated keypair loader from local identity store
- docs(architecture): update protocol contract relationship diagrams
- refactor(frontend): improve contract call error handling and notification banners
- perf(frontend): optimize tree shaking for @stellar/stellar-sdk imports
- docs(security): document internal audit verification and invariant guarantees
- docs(pilot): update Level 6 cohort recruitment metrics and milestones
- docs(user-guide): add step-by-step wallet connection guide for Freighter
- docs(user-guide): add group creation wizard documentation for Mainnet
- docs(user-guide): document governance voting and join approval workflow
- docs(user-guide): document period rotation and pot distribution mechanics
- docs(api): add contract interface reference for FactoryContract methods
- docs(api): add contract interface reference for GroupContract methods
- chore(ci): configure GitHub Actions workflow for contract compilation checks
- chore(config): verify Vite build configuration for production deployment
- feat(frontend): enhance mobile responsive layout for savings dashboard
- style(frontend): adjust badge styling for Mainnet verified status
- docs(submission): update commit milestone metrics to 100+ commits
- docs(submission): verify StellarExpert transaction explorer links
- docs(submission): add testnet to mainnet migration retrospective
- docs(faq): add frequently asked questions for ROSCA circle participants
