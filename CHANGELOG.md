# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Zustand store for centralized pipeline state management
- localStorage persistence with debounced saves (500ms) for pipeline state
- Clear pipeline button in header (top right) to reset all state and clear localStorage
- Generic `nodeState` storage system for node-specific data (replaces genie/URL-specific fields)
- Added markdown rendering to genie chat responses and inference node outputs

### Changed
- Refactored state management from multiple hooks (`usePipelineState`, `useURLLoader`, `useGenieState`) to a single Zustand store
- Store is now completely generic - no business logic, only state management
- Hooks (`useGenieState`, `useURLLoader`) now use the store's generic `nodeState` instead of separate state
- Pipeline state automatically persists to localStorage and restores on page load
- Changed default temperature from 0.7 to 0.4 for inference and genie nodes

### Removed
- Removed genie-specific and URL-specific fields from store (now use generic `nodeState`)

