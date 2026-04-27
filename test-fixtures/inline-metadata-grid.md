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
