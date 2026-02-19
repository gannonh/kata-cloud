# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-19

### Added
- Deterministic orchestrator run lifecycle transitions and status projections
- Renderer wiring for orchestrator lifecycle and status-panel display
- Typed context retrieval IPC contracts with diagnostics persistence
- Run-history recoverability with malformed payload recovery
- Provider retrieval failure normalization
- Interrupted run lifecycle contracts and startup recovery
- Run context provenance capture and rendering
- Orchestrator-context guardrail suite and integrated Electron UAT
- Context retrieval contract and API documentation
- Brand guidelines, logo assets, app icons, and themes
- Mintlify documentation site
- Initial settings configuration for permissions and server setup

### Fixed
- Context retrieval error handling and state guard hardening
- Context fallback provenance persistence
- Orchestrator run record normalization with logging for dropped records
- Silent catch blocks replaced with explicit logging
- PR review findings across phases 5-8

### Changed
- Removed outdated screenshot mocks; updated test command for verbose reporting
- Consolidated IPC/service request types into single definitions
- Removed unused fields from OrchestratorRunTransitionResult
