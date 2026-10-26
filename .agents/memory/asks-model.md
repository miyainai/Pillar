---
name: Asks model decisions
description: Where asks live, how ownership works, and the drag-and-drop people picker; user-stated preferences behind them.
---

# Asks model decisions

**Asks are home in the Asks tab.** The user said that when the same feature shows on two
tabs, clicking it should "bump you back to the tab that is home for it" instead of
syncing two copies. Plan/pillar pages therefore only list linked asks read-only and
link out with query params (`?pillar=`, `?new=1&pillar=`). Do not re-add ask forms or
drag-and-drop to plan pages.

**Several owners per ask.** The user asked to "assign the same task to multiple people"
and to drop the dropdown for a drag-and-drop picker: everyone's first name and headshot
below the box, hover shows full name and function, drag in to assign, drag back out to
remove. Click is kept as a fallback (touch, keyboard, tests). An ask never has zero
owners; VP and above change owners.

**Why click + drag:** HTML5 drag does not work on touch devices and is awkward for
keyboard users; the bench is always rendered (even when everyone is assigned) so there is
always a drop target to drag back to.

**Gotcha:** the shared `Field` component renders a `<label>`; a button-based picker
inside it would receive clicks aimed at the label text. Use `<Field group>`.

**Downloads:** the user wanted the associate to download what management uploads. Real
upload bytes live in IndexedDB (browser-local demo); seeded files download as labelled
sample files so the button never dead-ends.

**Backward moves:** allowed with a required reason (except straight back to management);
the asker may send their own delivered ask back. "In your court" moved from the Plan tab
to the dashboard with per-person chips.
