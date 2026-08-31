# Pilot feedback collection

How participant feedback is collected, exported, and fed back into the roadmap.

## Form schema

The onboarding form collects the fields Level 6 requires, in this order:

| # | Field | Type | Required | Notes |
| -: | :---- | :--- | :------- | :---- |
| 1 | Timestamp | auto | — | Added by Google Forms |
| 2 | Email address | Short answer | yes | Form setting: *Collect email addresses* |
| 3 | Full name | Short answer | yes | |
| 4 | Stellar wallet address | Short answer | yes | Validated: starts with `G`, 56 characters |
| 5 | How would you rate Plexa? | Linear scale 1–5 | yes | 1 = poor, 5 = excellent |
| 6 | What was confusing or frustrating? | Paragraph | no | The field that actually drives the roadmap |
| 7 | What would make you use this regularly? | Paragraph | no | |

**Wallet address validation** (Forms → question → Response validation):
regular expression, *Matches*, pattern `^G[A-Z2-7]{55}$`.

## Export procedure

1. Google Form → **Responses** → green Sheets icon → *Create new spreadsheet*.
2. Share the spreadsheet with view access: [Google Sheet Feedback](https://docs.google.com/spreadsheets/d/1Hc3Hp1LWov_zRv7xerMRvo18IKWWBSK_Kn3P41_JaZU/edit?usp=sharing).
3. Link it from the README's feedback section.

## Analysis method

Responses are read for *recurring friction*, not for the average rating. A
rating tells you nothing actionable; the free-text answer in field 6 is what
produces a code change. Each recurring theme becomes a row in the README's
"Improvements shipped in response" table, with the commit that addressed it.

## Honest limits of this dataset

The pilot cohort was recruited and wallet-funded by the Plexa team rather than
arriving organically. That has two consequences worth stating rather than
hiding:

- **Selection bias.** Participants were invited, so they are more favourably
  disposed than a random user would be. Ratings from this cohort should not be
  read as market validation.
- **Small n.** The response count is far too small for any statistical claim.

What the dataset *is* good for is the thing it was used for: finding concrete
usability defects in the mainnet flow. Twelve of the thirteen shipped
improvements in the README came directly from watching pilot participants get
stuck, and those defects were real regardless of how the cohort was recruited.

Moving to independently-sourced users who fund their own wallets is the first
item on the next-phase roadmap.
