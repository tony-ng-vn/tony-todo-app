**Web App**

- Typing and running timers no longer rebuild a date formatter every second, so long histories tick without burning CPU.
- An open task photo now reuses its signed display link instead of requesting a new one every second while a timer runs.
- Link titles in the menu bar list are fetched once and shared across rows instead of refetched on every popover open.
- The menu bar popover and the native windows no longer load web analytics scripts, trimming their startup cost.
