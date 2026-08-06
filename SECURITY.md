# Security Policy

This repository is a satellite/example client for the
[Suwappu API](https://github.com/0xSoftBoi/suwappubot). It demonstrates the
hosted A2A natural-language route.

The current A2A route is quote/discovery-oriented and has no swap execution
method. This CLI contains no transaction signing, broadcasting, or managed
execution path. Its Suwappu API key is still sensitive because the same
credential can authorize other agent API capabilities outside this example.

## Reporting a vulnerability

**Do not open a public issue for security reports.** Instead:

- Use **GitHub Private Vulnerability Reporting** when it is enabled for this repository, or
- Email **security@suwappu.bot**.

Please include the affected file, version or commit, reproduction steps, and an
impact assessment.

**Scope note:** issues in this repository's A2A client, request handling,
dependencies, or CI belong here. Vulnerabilities in the Suwappu API, core bot,
smart contracts, custody/key-management layer, or shared SDK should be reported
upstream through the
[core security policy](https://github.com/0xSoftBoi/suwappubot/security/policy).

## Capability boundary

Natural-language `swap ...` currently returns a quote. Do not interpret that
word as approval to prepare, sign, broadcast, or submit a transaction.

MCP unsigned transaction preparation and the agent REST managed-execution path
are separate capabilities with separate security decisions. If this example is
extended to use either one, require an explicit local capability policy and
update its user-facing warnings before enabling it.

Use test credentials during development and never commit API keys.

## Our commitment

- **Acknowledge** reports within 3 business days.
- **Triage and severity** within 7 business days.
- **Coordinate disclosure** with the reporter and provide credit unless
  anonymity is requested.

## Safe harbor

Good-faith research conducted under this policy, without privacy violations,
data destruction, or service degradation, will not result in legal action from
us. If in doubt, contact us before testing.
