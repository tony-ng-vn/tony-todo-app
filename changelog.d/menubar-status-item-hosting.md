**Native App**

- The menu bar checkmark now waits until macOS actually hosts it before the full Done Log window opens, so the icon no longer disappears after launch.
- Local `npm run menubar` builds stay off the installed app, and the installer refuses development or Sparkle-less bundles so production Done Log cannot be overwritten by accident.
