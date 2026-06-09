# Animation Opportunities

## Useful animation opportunities

- **Task completion confirmation:** A small Lottie can make the "Done" action feel acknowledged and show the task becoming part of the daily ledger. This is the best Lottie target because it is a short narrative state change with multiple coordinated parts.
- **Empty recap state:** The existing `static/lottie/empty-recap.json` is appropriate for the blank daily ledger. It can stay quiet and loop slowly because it is informational, not action feedback.
- **Timer running state:** A subtle Lottie or CSS pulse could clarify active tracking, but it should stay secondary to the task title and duration. A reusable `timer-running.json` would be appropriate only if it is displayed in a constrained icon-sized area.
- **Summary reorder feedback:** Drag/drop target changes benefit from simple CSS transitions, because they are direct manipulation and should feel immediate.

## Where CSS is better

- **Button hover/press states:** The current `180ms` transitions and `:active` scale are the right tool. Lottie would add complexity without improving feedback.
- **New task insertion:** The existing `block-enter` and `cue-enter` CSS animations are well matched to layout changes and should remain CSS.
- **Panel/detail focus changes:** CSS opacity/transform transitions are enough if the app later animates detail entrance or close behavior.

## Where Lottie is appropriate

- **`task-complete.json`:** Added as a reusable one-shot completion cue. It shows a task row sliding into a ledger track, then a check mark settling into place. It uses shape layers only, normalized RGBA colors, grouped shape items, and short eased keyframes compatible with Skottie-style rendering.
- **Future candidates:** A small timer-running asset or an enhanced empty-recap asset could be useful, but only after deciding where the app should render them. Avoid adding decorative looping Lotties to active task rows because they may compete with the live timer text.

## Text-to-Lottie assessment

The installed `text-to-lottie` skill is useful here for authoring and checking the JSON mechanics: top-level Lottie shape, shape-layer transforms, grouped shape items, normalized colors, and Skottie-compatible keyframes. It does not decide product placement, so the report separates interaction opportunities from asset authoring.
