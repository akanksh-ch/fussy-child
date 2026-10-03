# Repository Guidelines

## Project Structure & Module Organization

This repository is an early-stage browser game project. `IDEA.md` describes the intended gameplay and product requirements; `README.md` is the short project introduction. Art files live in `assets/`, including item icons in `assets/Icons/` and the Kenney pixel-adventure UI pack in `assets/kenney_ui-pack-pixel-adventure/`. Keep source code, tests, and any build setup in clearly named directories when they are introduced. Preserve the supplied asset directory structure so references remain easy to follow.

## Build, Test, and Development Commands

There is currently no application source, package manifest, or build/test configuration, so no project-specific run or test command is available. When adding an implementation, document its setup and commands in `README.md` and keep them aligned with the checked-in scripts or configuration. Avoid documenting commands that are not present in the repository.

## Coding Style & Naming Conventions

No language-specific formatter or linter is configured yet. Follow the conventions of the framework selected for the game and add its formatting/lint commands alongside the project setup. Use descriptive, lowercase file names; existing item assets follow names such as `fruit_orange.png` and `coffee_mediumroast.png`. Keep asset references consistent with those names and preserve licensing and attribution files shipped with third-party art.

## Testing Guidelines

No test framework or tests exist yet, and there is no coverage requirement. When introducing game logic, keep core behavior such as item selection, win detection, and reset behavior testable independently of presentation. Add the chosen test command to the README and use the framework’s standard test file naming pattern.

## Commit & Pull Request Guidelines

The available Git history contains only `Initial commit`, so it does not establish a commit message convention. Use short, imperative commit subjects that describe one change. Pull requests should explain the player-visible change, list relevant validation or note that no automated checks are configured, and include screenshots or a short recording for UI changes. Link related issues when available.

## Assets & Configuration

Keep credentials and local secrets out of the repository; use documented environment variables for any future API integrations. Retain third-party asset license and attribution files when adding or reorganizing art.
