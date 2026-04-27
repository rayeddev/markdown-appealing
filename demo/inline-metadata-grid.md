---
title: Inline metadata grid fixture
date: 2026-04-27
author: rayed
---

# Inline metadata grid — visual fixture

Open this in the Extension Development Host (F5) to visually verify the grid across all three themes × light/dark mode.

## Form A: softbreak-separated (no blank lines between)

**Status:** verified — applied 2026-04-27 03:19 server time
**Group:** [2026-04-26-infra-cleanup](README.md)
**Risk:** low — config-only, fully reversible (we keep `.OLD` copies)
**Estimated downtime:** zero (config reload is hot)

## Form B: blank lines between (separate paragraphs)

**Owner:** platform team

**Severity:** P2

**Reproduces:** every deploy

## Mixed: 2-segment para + 1-segment para

**Tag:** v0.7.0
**Channel:** stable

**Notes:** see CHANGELOG.md

## Singleton (must NOT fuse)

**Note:** this single line should remain a regular paragraph with bold prefix, not become a one-row grid.

## Run with surrounding prose

Some intro prose before the metadata block.

**Phase:** rollout
**Window:** 2026-04-27 03:00–04:00 UTC
**Approver:** ops oncall

Some closing prose after the metadata block.

## Inline markdown in values

**Repo:** [markdown-appealing](https://github.com/rayeddev/markdown-appealing)
**Branch:** `feat/inline-metadata-grid`
**Highlight:** *italic* and **bold** and `code` together

## Negative cases (must NOT render as a grid)

### Empty values

A line with no value text after the colon must not contribute to a run. The block below should render as two regular bold-prefixed paragraphs, not a grid.

**Empty:**
**Group:** g1

### Colon outside the bold

`**Status**: verified` (colon outside `**`) is treated as prose. Should render as two regular paragraphs.

**Status**: verified
**Group**: g1

### Trailing prose after a softbreak — paragraph rejected

The first paragraph mixes 2 matching lines with trailing prose. The whole paragraph stays as prose.

**Phase:** rollout
**Window:** today
trailing closing remark.

### Two single-match paragraphs separated by prose

Each is a singleton; neither should fuse.

**Solo A:** alpha

prose between them.

**Solo B:** beta

### Multi-colon label (`Status::`) is rejected

**Status::** verified
**Group:** g1

## Integration cases

### Inside a GitHub alert (must NOT promote to grid)

> [!NOTE]
> **Status:** inside an alert
> **Group:** still inside

### Inside a code fence (must NOT promote to grid)

```
**Status:** literal
**Group:** literal
```

### Inside a blockquote (must NOT promote to grid)

> **Status:** inside blockquote
> **Group:** inside blockquote
