# Changelog

All notable changes to this repository are documented here.

## 2.0.0 — 2026-08-07

### Added

- a compiled CLI build and high-severity dependency audit release gate;
- a non-root container contract and CodeQL workflow;
- an operations runbook, contributor policy, and paid-product build guide;
- a bounded `SUWAPPU_OPERATION_TIMEOUT_MS` request deadline.

### Changed

- HTTP failures no longer copy raw upstream response bodies into errors;
- CI now uses the lockfile and validates the distributable CLI/container;
- the repository is explicitly operated as a read-only A2A front door, with unknown-outcome retries documented.

## 1.1.0

- A2A 0.3 request/task compatibility, bounded task polling, Agent Card discovery, and TypeScript/Python parity.
