# Operations Runbook

This runbook covers Suwappu Natural-Language CLI 2.x as a read-only A2A client. It has no signing, broadcasting, unsigned transaction-preparation, or managed-execution path.

## Production contract

`--card` is anonymous discovery. Message/task methods use `SUWAPPU_API_KEY`. Every outbound request has a 25-second default deadline (`SUWAPPU_OPERATION_TIMEOUT_MS`, integer `100..30000` ms); asynchronous task polling is separately bounded by `SUWAPPU_A2A_POLL_TIMEOUT_MS`.

Use distinct credentials per environment. Treat request text, task IDs, and returned artifacts as customer data. Do not put credentials in prompts, command history, screenshots, or persistent task records.

## Retry and reconciliation

- A timeout during `tasks/get` is safe to retry because it is a read.
- A timeout during `message/send` is **outcome unknown**. Do not blindly replay the same customer intent; first inspect server/task state or require a deliberate new submission.
- Cancellation is explicit and best-effort. A failed cancellation request does not prove that work continued or stopped.
- `history` in the interactive CLI is process-local convenience state, not an audit ledger. A hosted product needs its own durable task ledger.

## Rate/cost control

The CLI does not create an unbounded background loop by itself. A multi-tenant wrapper still needs explicit per-customer concurrency, request-rate, and spend budgets. Apply those limits before calling A2A, and measure actual Suwappu/model/storage/delivery cost per retained customer.

## Container operation

The image runs as the unprivileged `bun` user and defaults to `--help`, so deploying it cannot silently start a request loop.

```bash
docker build -t suwappu-natural-language-cli .
docker run --rm suwappu-natural-language-cli --help
```

Inject credentials through the runtime secret mechanism only when executing authenticated commands.

## Health and SLO signals

Track request success rate and latency by A2A method, terminal-task completion rate, poll-timeout rate, unknown-outcome `message/send` count, cancellation failures, rate-limit responses, and per-customer request/cost volume. Do not set an SLO around profitable quotes; market outcome is not service availability.

## Incident order

1. Stop new scheduled/automated submissions while preserving task IDs and sanitized logs.
2. Determine whether the incident is discovery/read polling or outcome-unknown submission.
3. Reconcile task state before replaying any customer intent.
4. Revoke/rotate the affected Suwappu key if credential exposure is plausible.
5. Restore with one bounded `--card`/read request before resuming automation.

## Release gate

Every release must pass TypeScript typecheck/tests/build, Python compile/smoke checks, high/critical dependency audit, non-root container build, and CodeQL. Review the A2A authority boundary, error sanitization, timeout/retry semantics, and docs in the same change.
