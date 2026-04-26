---
name: zentro-cross-platform-build
description: >
  Reliable cross-platform build and packaging practices for Wails desktop releases.
---

# Skill 10: Cross-Platform Build

## Purpose

Produce reproducible Windows/macOS artifacts with clear prerequisites and release checks.

## Mandatory Rules

- Keep build/version metadata consistent.
- Use scripted build commands for repeatability.
- Track platform-specific prerequisites (CGO, signing, notarization).
- Run smoke tests on produced artifacts.

## Verification

- Build pipeline passes for target OS.
- Startup/connect/query/export smoke checks pass per OS.
