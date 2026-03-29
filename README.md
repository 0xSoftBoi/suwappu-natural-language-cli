# suwappu-natural-language-cli

Interactive REPL for trading with plain English via [Suwappu](https://suwappu.bot) A2A protocol.

```
suwappu> swap 0.5 ETH to USDC on base
Quote ready: 0.5 ETH -> 1,247.50 USDC on Base

suwappu> price of ETH
ETH: $3,500.42 (+2.5% 24h)
```

## Quick Start

```bash
# Python
pip install requests && export SUWAPPU_API_KEY=suwappu_sk_... && python cli.py

# TypeScript
npm install && export SUWAPPU_API_KEY=suwappu_sk_... && npx tsx cli.ts
```

## Features

- Natural language: swap, quote, price, portfolio, chains
- Spinner animation while processing
- Task history (`history` command)
- Ctrl+C to cancel running tasks

[Docs](https://docs.suwappu.bot) | [A2A Protocol](https://docs.suwappu.bot/protocols/a2a)
