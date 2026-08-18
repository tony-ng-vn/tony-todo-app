**Web App**

- Task notes now keep each writing session under a Start/End time block: pressing Start writes a Start heading into the note, pausing or completing writes End, and every line typed in between belongs to that session.
- Typing the first note into a task that is not running starts its timer, so the note's Start heading and the tracked time begin together. Someday tasks and completed tasks are never started this way.
- The note editor shows exactly what you typed: the headings stay hidden, blank lines you add are kept, and older notes with per-bullet time stamps still read as one continuous list.

**Backend**

- The agent's appendNote command now files new text under the task's open session, or opens a fresh Start heading at the current time when there is none.
