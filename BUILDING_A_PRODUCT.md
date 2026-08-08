# Build a Natural-Language Product on Suwappu

The useful primitive here is not “an AI that can trade.” It is a **read-only natural-language front door** that turns a user's words into inspectable Suwappu tasks while preserving a hard authority boundary.

## Product ladder

| Stage | Customer job | What you add | A2A authority |
| --- | --- | --- | --- |
| Concierge | “Answer a market/route question in plain language.” | saved conversations, clear artifacts | quote/discovery |
| Team inbox | “Let us hand off and review agent requests.” | accounts, task ledger, assignments, notes | quote/discovery |
| Monitor | “Run approved read prompts on a cadence.” | scheduler, budgets, dedupe, delivery | quote/discovery |
| Approval handoff | “Turn an accepted idea into a reviewed action.” | explicit structured intent + separate SDK/REST surface | still none in A2A |
| Execution product | “Carry out that approved intent.” | authorization, policy, custody, simulation, recovery | separate product boundary |

Do not widen the A2A client's authority simply to climb this ladder. The handoff between conversation and execution is valuable precisely because it is explicit.

## Store a task ledger, not just chat text

For a multi-user product, persist an application-owned record containing the customer/request identity, A2A task ID, requested capability class, timestamps, terminal state, and a reference to the returned artifact. Keep API keys out of that record.

Treat `message/send` timeouts as **outcome unknown**. A retry may create another task. Reconcile through server/task state where possible and make any application-level repeat deliberate and auditable.

## Meter the loop

Before choosing a polling or automation cadence, measure:

```text
builder contribution margin
  = subscription + usage revenue
  - Suwappu usage
  - model inference
  - storage + delivery + compute
  - payment fees + attributable support
```

Do not use a customer's quoted edge or trading P&L as builder revenue.

Useful activation/retention events are concrete: first successful task, first artifact saved/shared, first repeat request, first team handoff, and retained active workflows after 7/30 days. “Messages sent” alone is a weak success metric.

## Enterprise handoff gate

Before a downstream product can move funds, require all of the following outside this CLI:

1. translate free text into a typed intent with chain/assets/amount and freshness;
2. show the normalized intent to the user or deterministic approval policy;
3. record approval in application state, never infer it from model prose;
4. obtain a fresh wallet-bound quote and simulate where supported;
5. enforce server-side wallet policy plus local limits;
6. persist idempotency/reconciliation state before submission;
7. treat timeouts and partial/unknown outcomes as reconciliation events, not permission to resubmit.

The A2A client intentionally stops before step 1 becomes transaction authority.
