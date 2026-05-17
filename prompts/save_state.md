Save the current session state by updating the architecture files.

**Step 1 — Update app_UI.md** if any UI changes were made this session:
- Add a row to the Decisions Log (date + what changed)
- Update the relevant section (tile style, page layout, colours, formatting, etc.)
- Do not describe code; describe the visual result and the decision

**Step 2 — Update ARCHITECTURE.md** if any of these changed this session:
- Files added or deleted (update Active File Map)
- Navigation flow changed
- New UI sections added or finalized
- Cache layer changes
- New invariants or constraints discovered

**Step 3 — Update CLAUDE.md** if any of these changed this session:
- Validated numbers changed (FX rate, portfolio totals)
- New constraints added
- Known issues resolved or discovered
- Boot protocol needs updating

**Step 4 — Report:**
1. What was changed in each file (or "no changes needed")
2. One-line summary of what was accomplished this session
3. Recommended next step for the next session

Keep all files concise. Do not add implementation detail that belongs in code comments.
Do not run git or any deploy commands.
