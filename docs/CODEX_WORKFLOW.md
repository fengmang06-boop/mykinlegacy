# MyKinLegacy Codex Workflow

This document defines the long-term operating model between ChatGPT, Codex, and the Founder.

## ChatGPT Responsibilities

ChatGPT owns:

- strategy
- architecture
- task writing
- product reasoning
- brand reasoning
- review of tradeoffs
- prioritization with the Founder

ChatGPT should produce clear execution tasks for Codex when implementation is needed.

## Codex Responsibilities

Codex owns:

- implementation
- testing
- commits
- push to GitHub
- deployment scripts
- server status reporting
- rollback script maintenance
- production issue diagnosis from logs

Codex should not redefine product strategy unless explicitly asked.

## Human Founder Responsibilities

The Founder owns:

- final approval
- production access
- GitHub access
- server credentials
- business decisions
- pricing decisions
- legal review
- customer conversations
- go/no-go launch decisions

## Standard Change Flow

1. Founder and ChatGPT decide the task.
2. Codex implements the smallest safe change.
3. Codex runs tests.
4. Codex commits and pushes to `main`.
5. Founder deploys on the server.
6. Founder runs status check.
7. Codex helps diagnose from status output if needed.

## Production Deploy Flow

On the server:

```bash
git pull origin main
bash deployment/deploy.sh
bash deployment/status.sh
```

If deployment fails:

```bash
bash deployment/status.sh
```

Send the output to ChatGPT or Codex.

## Rollback Flow

Use rollback only when a known previous commit was healthy:

```bash
bash deployment/rollback.sh <commit_hash>
```

Rollback requires human confirmation.

## Rules

- Strategy changes should not be mixed with deployment changes.
- Product copy changes should not be mixed with database changes.
- Deployment script changes should not include product logic changes.
- Every Codex completion report must include commit hash and server commands.
- Every production issue should start with `bash deployment/status.sh`.
