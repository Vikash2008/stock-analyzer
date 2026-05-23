# layout_mobile.md — Mobile Layout Reference

> Read this before placing any new UI element on mobile.
> Measured from the JS probe on the user's actual phone.

---

## Measured Values (fill in after probe runs on phone)

| Property                        | Value      |
|---------------------------------|------------|
| Device                          | Google Pixel 10 |
| Physical resolution             | 1080 × 2424px |
| Device pixel ratio (DPR)        | ~2.625     |
| CSS viewport width              | **411px**  |
| Effective content width (after 12px padding each side) | **387px** |

---

## Estimated Values (based on CSS rules, until measured)

Streamlit wide layout, mobile padding override `0.75rem` each side:
- **Content width** ≈ screen_width − 24px
- iPhone SE (375px): content ≈ **351px**
- iPhone 14 (390px): content ≈ **366px**
- Android common (360px): content ≈ **336px**

---

## Column Width Calculator

Formula: `col_width = content_width × ratio − gap_px`
Streamlit default column gap ≈ 8px per column (varies by `gap=` param).

| Ratio       | col1 (351px base) | col2       |
|-------------|-------------------|------------|
| [1, 1]      | ~167px            | ~167px     |
| [2, 1]      | ~226px            | ~109px     |
| [3, 1]      | ~255px            | ~79px      |
| [3, 2]      | ~203px            | ~132px     |
| [4, 1]      | ~272px            | ~63px  ⚠️ too narrow for selectbox |

**Minimum safe column width for widgets:**
- `st.selectbox`: ~110px (shows truncated text but still tappable)
- `st.radio` horizontal, 2 options: ~160px minimum
- `st.button` (auto-width): ~50px minimum
- `st.button` (full-width): fills column

---

## Widget Height Reference (approximate)

| Widget                              | Height  |
|-------------------------------------|---------|
| `st.radio(horizontal=True)` no label | ~36px  |
| `st.radio(horizontal=True)` with label | ~56px |
| `st.selectbox` no label             | ~36px   |
| `st.selectbox` with label           | ~56px   |
| `st.button`                         | ~34px   |
| `st.markdown` single line           | ~20px   |
| Card `_card()` compact              | ~72px   |
| Card `_card()` hero                 | ~90px   |

**Key rule:** When placing two widgets side by side in columns, both must use `label_visibility="collapsed"` to avoid height mismatch causing visual misalignment.

---

## Safe Layout Patterns

### Pattern 1: Two widgets same line
```python
c1, c2 = st.columns([X, Y], gap="small")
with c1:
    st.radio("Label", options, horizontal=True, label_visibility="collapsed")
with c2:
    st.selectbox("Label", options, label_visibility="collapsed")
```
- Use [2, 1] minimum — col2 must be ≥ 110px (selectbox min)
- Both labels MUST be collapsed

### Pattern 2: Full-width radio + compact row below
```python
st.radio("Label", options, horizontal=True, label_visibility="collapsed")
# sort or secondary control on next line
```
- Safest pattern, no column tricks needed

### Pattern 3: Sort pills (6 options)
```python
cols = st.columns(6, gap="small")
for i, (lbl, val) in enumerate(zip(SHORT_LABELS, LONG_LABELS)):
    with cols[i]:
        if st.button(lbl, key=f"sort_{i}", use_container_width=True):
            st.session_state["sort"] = val
```
- Each col ≈ 351/6 = 58px — short labels ("Val", "P&L", "P%", "XIRR", "Day", "D%") fit
- Works reliably but uses 6 columns (use only for pill rows)

---

## No-Go Rules

| Rule | Why |
|------|-----|
| No `st.columns(N > 2)` for content cards | Cards overflow narrow columns |
| No hardcoded `width: Xpx` in HTML | Overflows on small screens |
| No `font-size > 14px` in inline HTML | Too large on mobile |
| Never mix labeled + unlabeled widgets in the same column row | Height mismatch causes misalignment |
| Never assume col width — calculate from table above | Guessing causes the recurring layout bug |
