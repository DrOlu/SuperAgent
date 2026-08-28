---
title: Launch on boot now follows the saved setting
category: changed
severity: notice
introduced_in_pr: "#19311"
date: 2026-08-28
---

## What changed

The Launch on boot setting is now applied to the operating system when SuperAgent starts and whenever the setting
changes. Previously, the app saved the preference without reliably updating the system startup registration.

## Why this matters to the user

Enabling the setting now registers SuperAgent to launch at login. A saved disabled setting removes SuperAgent's
managed startup registration, including the Linux autostart desktop file.

## What the user should do

Nothing — automatic. Users who manage SuperAgent startup outside the app should review the saved Launch on boot
setting after updating.
