**Web App**

- Removed the Progressive checkbox. Work that already spans more than one San Francisco day is archived into that day's recap automatically, and Done always finishes the task.
- Leftover prior-day time is merged into that day's existing recap session instead of being dropped.
- Recap titles are more prominent, Start shows clock time only, and items in each recap section are ordered by end time.

**Native App**

- The menu bar companion no longer has a Progressive toggle. Finish completes the task; earlier days still show up in recap.
- Completing or starting a timer also saves merged recap sessions, not only newly created ones.

**Backend**

- Completing a task from the agent now also saves any archived prior-day recap sessions, including updates to sessions that already existed.

**Docs**

- Documented automatic multi-day recap instead of manual progressive session logging.
