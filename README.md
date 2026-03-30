# suwappu-natural-language-cli

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://python.org)

Interactive REPL for trading with plain English via the [Suwappu](https://suwappu.bot) A2A (Agent-to-Agent) protocol.

> **Warning**: This CLI can execute real trades. Use test wallets and review quotes before confirming.

## Example Session

```
suwappu> swap 0.5 ETH to USDC on base
Quote ready: 0.5 ETH -> 1,247.50 USDC on Base

suwappu> price of ETH
ETH: $3,500.42 (+2.5% 24h)

suwappu> show my portfolio
Portfolio: $12,450.00 across 3 chains

suwappu> history
  #  Task ID                    State        Time
  1  a1b2c3d4-e5f6-7890-abcd   completed    12:00:00
  2  b2c3d4e5-f6a7-8901-bcde   completed    12:00:05
```

## Install

```bash
bun install  # TypeScript
pip install requests  # Python
```

## Usage

```bash
export SUWAPPU_API_KEY=suwappu_sk_...

# TypeScript
bun run src/cli.ts

# Python
python cli.py
```

## Commands

| Command | Description |
|---------|-------------|
| `swap 0.5 ETH to USDC on base` | Get a swap quote |
| `price of ETH` | Check token price |
| `prices for ETH, BTC, SOL` | Multiple prices |
| `show my portfolio` | View balances |
| `list supported chains` | Supported networks |
| `history` | View task history |
| `help` | Show available commands |
| `quit` | Exit |
| `Ctrl+C` | Cancel running task |

## Development

```bash
bun test && bun run check
```

## Links

- [Suwappu Docs](https://docs.suwappu.bot) | [A2A Protocol](https://docs.suwappu.bot/protocols/a2a)

## License

MIT
