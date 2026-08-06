# suwappu-natural-language-cli

A copyable TypeScript + Python client for [Suwappu](https://suwappu.bot)'s A2A 0.3 natural-language interface.

The important boundary is simple: **the hosted A2A route does not execute swaps today**. Natural language such as `swap 0.5 ETH to USDC on base` returns a quote. This CLI never signs, broadcasts, or submits managed swap execution.

## Why this repo exists

Use this example when you want an agent-to-agent natural-language front door and want to see the wire contract rather than hide it behind a framework.

It demonstrates:

- public Agent Card discovery at `/.well-known/agent.json`
- authenticated JSON-RPC `message/send`
- A2A 0.3-style task lookup/cancel with `params.id`
- compatibility with Suwappu response parts that carry `kind`, `type`, or both
- terminal task handling plus bounded polling for `submitted` / `working`
- JSON-RPC error parsing even when the HTTP status is non-2xx
- request timeouts and endpoint overrides
- interactive and one-shot CLI modes

The production protocol helpers live in `src/a2a.ts` and are imported by the test suite.

## Pick the right Suwappu surface

| Surface | Best for | Transaction semantics |
| --- | --- | --- |
| A2A `/a2a` | Natural-language quotes, prices, discovery, agent-to-agent UX | No swap execution method today |
| Hosted MCP `/mcp` | Structured agent tools, portfolio/data, simulation, perps/prediction/lending | MCP `execute_swap` prepares an **unsigned** self-custody transaction |
| Agent REST / SDK | Explicit application integrations | Managed execution is a separate `POST /v1/agent/swap/execute` capability |

Do not treat A2A “swap,” MCP `execute_swap`, and managed REST execution as aliases. They are different custody/capability boundaries.

## Install

TypeScript/Bun:

```bash
bun install
bun run check
bun test
```

Python:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Discover first

The Agent Card is public, so you can inspect it without an API key:

```bash
bun run src/cli.ts --card
python cli.py --card
```

Raw discovery is also just HTTP:

```bash
curl https://api.suwappu.bot/.well-known/agent.json
```

Builders should discover the card instead of hard-coding a server version or skill count.

## Configure

A2A message/task methods require your Suwappu API key:

```bash
export SUWAPPU_API_KEY=suwappu_sk_...
```

Optional overrides:

```bash
export SUWAPPU_A2A_URL=https://api.suwappu.bot/a2a
export SUWAPPU_AGENT_CARD_URL=https://api.suwappu.bot/.well-known/agent.json
export SUWAPPU_A2A_POLL_TIMEOUT_MS=120000
```

See `.env.example`.

## Run

Interactive TypeScript:

```bash
bun run src/cli.ts
```

Interactive Python:

```bash
python cli.py
```

For scripts and smoke tests, send one message and exit:

```bash
bun run src/cli.ts --once "price ETH SOL"
python cli.py --once price ETH SOL
```

## Current natural-language behavior

| Input | Current A2A behavior |
| --- | --- |
| `swap 0.5 ETH to USDC on base` | Returns and caches a quote; does not execute |
| `quote 100 USDC to WBTC on base` | Returns a quote |
| `price ETH SOL BTC` | Returns current price data |
| `chains` | Lists supported chains |
| `tokens on solana` | Lists the built-in Solana token set |
| `balance 0x...` | Returns a hint to use MCP/REST for the actual portfolio |
| `help` | Returns server-side A2A help |

Local CLI commands are `card`, `history`, `help`, and `quit`.

`history` is **local A2A task history**, not on-chain swap history. For actual portfolio data use MCP `get_portfolio`; for swap history use MCP `get_swap_history` or the agent REST API.

## A2A request shape

The clients send an A2A 0.3-aware message and retain the compatibility `type` field accepted by the current Suwappu server:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "message/send",
  "params": {
    "message": {
      "kind": "message",
      "role": "user",
      "parts": [
        {
          "kind": "text",
          "type": "text",
          "text": "quote 1 ETH to USDC on base"
        }
      ]
    }
  }
}
```

Task methods use the current parameter name:

```json
{"jsonrpc":"2.0","id":2,"method":"tasks/get","params":{"id":"TASK_ID"}}
```

The Suwappu server currently accepts legacy `taskId` too, but new integrations should send `id`.

## Builder notes

- Always parse the JSON-RPC envelope before assuming an HTTP error has no structured details.
- Treat task ids as opaque and scoped to the authenticated agent.
- Handle both immediately completed tasks and future asynchronous `submitted` / `working` tasks.
- Bound polling and keep cancellation explicit.
- Discover the Agent Card, but still design your application around the capabilities it intentionally allows.
- If your product needs execution, make that a separate, explicit integration decision rather than inferring it from natural-language “swap.”

## Links

- [Suwappu](https://suwappu.bot)
- [Suwappu docs](https://docs.suwappu.bot)
- [Suwappu core](https://github.com/0xSoftBoi/suwappubot)

## License

MIT
