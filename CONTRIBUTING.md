# Contributing

Thanks for improving the Suwappu Natural-Language CLI. Its authority boundary is intentionally narrow: **A2A quote/discovery only**. A natural-language `swap` request must not become signing, broadcasting, or managed execution in this repository.

## Development

Requires Bun 1.3.14+ and Python 3.12+ for the companion client.

```bash
npm ci
bun run verify
python -m py_compile cli.py
```

Tests must use mocked/fake transport behavior. They must not spend Suwappu credits or move funds.

## Pull-request bar

A change is ready when it:

- preserves quote/discovery-only authority;
- treats task IDs as opaque and keeps cancellation explicit;
- bounds network/polling waits and handles unknown outcomes without blind replay;
- never logs API keys or raw non-2xx upstream response bodies;
- keeps Agent Card discovery separate from application authorization policy;
- updates `README.md`, `BUILDING_A_PRODUCT.md`, and `docs/OPERATIONS.md` when the operator/product contract changes;
- passes TypeScript typecheck/tests/build/audit, Python smoke checks, container build, and CodeQL.

## Security

Do not put vulnerability details in a public issue. Follow [SECURITY.md](SECURITY.md).
