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
