# Lifetime gift: real-Chrome scenarios

    node scripts/check-lifetime-gift.mjs --harness /tmp/lg && cd /tmp/lg && python3 -m http.server 8765

No Ghost, no network: the pages stub window.MOAuth.

Dashboard, `dash.html?mode=<m>`:
- `eligible2`: block visible, "2" left, no list rows, address note visible.
- `eligible1`: "1" left, one row. Submit `bad@example.test`: the error line shows and Sent! does not. Submit any other address: Sent! shows while the form hides (last credit), remaining "0", a new row, POST body is `{recipient_email, recipient_name}`.
- `ineligible`, `failed`: block stays hidden.
- `oldworker`: block visible, address note hidden (status has no asks_address).

Survey, `survey.html?gift=1` and `survey.html`:
- `?gift=1`: gift line visible, "Question 1 of 8", step 8 (why did you join) absent. Fill street, city, postcode, country GB, press Next: one POST /api/member/address with country GB and state null, one POST /api/welcome-survey with location "United Kingdom".
- no flag: gift line hidden, "Question 1 of 9".
