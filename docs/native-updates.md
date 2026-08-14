# Native update architecture

## Goal

The Daymark update control must update the complete macOS application when it is running inside the native host.
It must not describe a web-page reload as a desktop application update.

## User flow

Current native releases expose `Check for Updates` in the menu bar page and in the application menu.
That action asks the native updater to check the signed release feed.
Sparkle presents the available version, verifies the downloaded archive, replaces `Daymark.app`, and relaunches the application.

The browser-only menu bar route keeps a separate `Reload latest` action for refreshing deployed web content.
A legacy native host without updater support shows `Install desktop update` and opens the stable bootstrap disk-image URL.

## Ownership

`AppUpdateCoordinator` owns Sparkle and is the only component allowed to initiate a native update check.
`MenuBarWebViewController` exposes a narrow `doneLogUpdater` message bridge to trusted Daymark pages.
The Svelte route selects one of three actions from host capabilities: native update check, legacy bootstrap download, or web reload.

The native application version comes from `CFBundleVersion` and `CFBundleShortVersionString`.
The SvelteKit deployment version remains a web-cache concern and never claims that a native binary is available.

## Release boundary

Native updates are published only from a version tag after the changelog-fragment release command has synchronized the package and application versions.
The release workflow builds with a Developer ID Application certificate, enables Hardened Runtime, notarizes and staples the application, creates the updater archive and bootstrap disk image, signs the Sparkle feed with EdDSA, and publishes the assets together.

The public update feed and update archive contain no private credentials.
The Developer ID certificate, notarization credentials, and Sparkle private key live only in GitHub Actions secrets.

## Bootstrap migration

Versions that predate the native updater cannot replace themselves.
Their remotely loaded menu bar page detects the missing native capability and sends the user to `Done-Log.dmg` from the latest GitHub release.

The bootstrap installer replaces the legacy `com.tonynguyen.donelog.macos` or `com.tonynguyen.donelog` bundle with the canonical `com.tonynguyen.donelog.menubar` bundle once.
After that installation, every native update keeps the canonical bundle identifier and uses Sparkle.

## Failure behavior

Pending notes are flushed before either an update check or a web reload.
If note flushing fails, the existing local retry record is preserved and the update check can continue.
Sparkle owns download, validation, installation, rollback-safe replacement, and relaunch errors.
The legacy bootstrap opens in the default browser instead of letting web content replace an executable directly.
