Run all three steps in order. No confirmation needed between steps.

---

## Step 1 — Mobile Optimisation

Review ONLY these mobile concerns in the changed dashboard files:
- Any `st.columns(N)` where N > 2 on a page that renders on mobile — reduce or wrap
- Any hardcoded pixel widths in HTML markdown that would overflow a 375px screen
- Any font sizes > 14px in HTML markdown that make text too large on mobile
- `use_container_width=True` present on all `st.dataframe` and `st.plotly_chart` calls

Apply fixes inline — minimal diff only. If nothing needs fixing, skip this step and say so.

---

## Step 2 — Git Save

Run in sequence:
```
git status
git add dashboard/ app.py app_UI.md ARCHITECTURE.md CLAUDE.md
git commit -m "UI update + mobile optimisation — $(date +%Y-%m-%d)"
```

Use today's date in the commit message. If git status shows nothing changed, skip commit and say so.

---

## Step 3 — Deploy

```
git push
```

After push completes, report:
- Streamlit Cloud URL: https://share.streamlit.io (user must check their dashboard for the exact app link)
- Deployment is automatic — Streamlit Cloud watches branch `master`, entry point `app.py`
- Cold start takes ~30–60s on first load after deploy

---

## Output

Print a short summary:
1. Mobile fixes applied (or "none needed")
2. Git commit hash
3. Deploy status
