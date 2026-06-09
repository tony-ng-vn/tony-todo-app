# Ideas

## Notion Sync

Keep InsForge as the app database and treat Notion as an external task source.

Initial sync direction:
- Import tasks from a selected Notion task database into this app.
- Store each imported task in `todos` with `source = 'notion'` and `notion_page_id`.
- Keep the app's daily recap powered by InsForge so completion history stays fast and reliable.

Useful behavior:
- Add tasks in Notion and see them appear in the app.
- Mark tasks done in the app and update the matching Notion page status to `Done`.
- Edit task notes in the app and eventually push the note back to Notion when a Notion page is linked.

Recommended rollout:
1. One-way import from Notion into InsForge.
2. Complete-back sync from the app to Notion status.
3. Optional Notion webhook support for near-real-time updates.

Open questions:
- Which Notion database/data source should be the source of truth?
- Which Notion properties map to title, status, due date, note, and priority?
- Should Notion tasks remain visible after they are marked done, or should the app own the completed-day log?
