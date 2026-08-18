**Web App**

- Removed the Progressive checkbox; work that already spans more than one San Francisco day is archived into that day's recap automatically, and Done always finishes the task.
- Leftover prior-day time is merged into that day's existing recap session instead of being dropped, and time tracked before per-segment history existed is kept.
- A timer left running past midnight lands in the day it was worked and keeps running into the new day, including at the exact rollover moment.
- Archived recap sessions are saved so that the web app and the menu bar companion cannot collide when both save the same session.
- Recap titles are more prominent, timing text is more subtle, Start shows clock time only, and items in each recap section are ordered by end time.

**Native App**

- The menu bar companion no longer has a Progressive toggle; Finish completes the task, and earlier days still show up in recap.
- Completing or starting a timer also saves merged recap sessions, not only newly created ones.

**Backend**

- Completing a task from the agent now also saves every archived prior-day recap session and timer change, including sessions that already existed.

**Docs**

- Documented automatic multi-day recap instead of manual progressive session logging.
