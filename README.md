# agent-code-playbook-kit

A small TypeScript kit for describing agent processes as human-oriented IR and compiling them into deterministic runtime playbooks.

This repository exists because agent process authoring is a different problem from:
- governance architecture
- runner execution
- MCP tool surfaces
- rich answer rendering

It sits between those layers.

## What is included

- `src/types.ts` — IR and runtime playbook types
- `src/compile.ts` — deterministic `IR -> playbook` compiler
- `src/lint.ts` — lightweight linting and warning surface
- `examples/` — public-safe process examples
- `test/` — focused tests for invariants

## Why this exists

Many agent systems jump directly from:
- natural-language process description
- to prompt glue
- to side effects

That is not enough for stable production behavior.

A stronger setup uses:
- human-oriented process IR
- deterministic compilation
- explicit tool allowlists
- field-level write policies
- machine-checkable definition of done

## Quick start

```bash
npm install
npm test
npm run build
npm run demo
```

## Example

The included example compiles a content-draft task flow into a runtime playbook with:
- queue entry by status
- task context reading
- task update field allowlist
- comment and artifact write permissions
- deterministic started/done recipe steps
- delivery requirements

## Design principles

- human intent first, runtime contract second
- deterministic compilation over prompt magic
- fail closed where possible
- keep invariants explicit

## Related repos

- [org-aware-agents](https://github.com/gritsev/org-aware-agents)
- [agent-code-runner-sandbox](https://github.com/gritsev/agent-code-runner-sandbox)
- [agent-code-observer-mcp](https://github.com/gritsev/agent-code-observer-mcp)
- [agent-code-a2ui-contracts](https://github.com/gritsev/agent-code-a2ui-contracts)
