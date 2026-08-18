**Web App**

- Replaced the inline add-task row with a search field and a New task button. Search narrows titles and notes as you type. Cmd+N opens a centered overlay with Task/Project, a date that starts on today, and an Add button that stays off until there is a title.
- Unmatched tasks fold up toward search as you type, and remaining rows close the gap. The add overlay arrives as a short glass sheet. Reduced-motion users get a fade instead of the fold.
- Duplicate titles now fail next to the overlay field. An empty search offers New task. Search can be cleared from the field. Folding rows leave slightly faster than they arrive.
- Search no longer nests a button inside the field label. Escape clears the query. Cmd+N refocuses the overlay if it is already open. Tap targets and 16px search type hold up on phones.
- While searching, a match count sits in the field. Closing the overlay keeps an unfinished title so New task can pick it back up. The overlay has a Close control. Overflow hits are labeled Also found.

**Native App**

- The menu bar uses the same overlay to add a task or project, and can search the open list from the top of the window.
- Menu bar search uses the same fold-up motion as the web list. Empty sections no longer claim there is nothing ready while a search is active. A match count and live status stay with the field.
