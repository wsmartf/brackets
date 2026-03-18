# 07 — About Page Rewrite (Human task, ship during tournament)

## Goal
Rewrite the about page so it sounds like a person wrote it, not a language model.

## Why
The current about page is technically accurate but reads like documentation. It explains the system to the system. It repeats the same idea five times. It apologizes for being detailed ("without turning the page into a wall of engineering notes"). A portfolio piece needs confident, human writing.

## This is primarily a HUMAN writing task
Claude can restructure the layout, but the words need to come from you. Here's a diagnostic of what's wrong and a suggested direction.

## What's wrong
1. **Repetition**: The core concept (number → PRNG → bracket → check against reality) appears in the hero, the pipeline, the example, the validation section, and the "short version." Five times.
2. **Self-conscious tone**: "A little more detail, without turning the page into a wall of engineering notes" — the page is narrating itself.
3. **Explains internals to nobody**: "The index is used as the seed for a PRNG" — no visitor cares about PRNGs. They care about the concept.
4. **Flat cadence**: Every sentence is declarative, mid-length, informational. No surprise, no rhythm, no "oh that's cool" moment.
5. **Undersells the model**: The KenPom logistic regression trained on 20+ years of data with proper backtesting is the most impressive technical element, and it gets one vague paragraph.

## Suggested structure (you should rewrite in your own voice)

### Section 1: The concept (3 sentences max)
What it is, why it's interesting, what happens during the tournament.

### Section 2: How brackets are generated (1 paragraph + optional expandable)
Team strength → win probabilities → repeatable random draws → 63 game picks.
One concrete example with real teams and numbers.

### Section 3: The model (this is your flex)
You built a logistic regression on 20 years of KenPom data. Proper train/validate/holdout. 74% accuracy, well-calibrated probabilities. This is real ML engineering, not a toy — say so.

### Section 4: How validation works (short)
Games happen. Brackets that got it wrong die. The universe shrinks.

### Section 5: Why this exists (optional, personal)
What inspired you. The Library of Babel connection. Why you think it's interesting.

## Implementation notes for Claude
- Restructure the JSX layout to match the new section flow
- Remove the 5-step pipeline (replace with the simpler structure above)
- Keep the visual design language (cards, dark accent blocks, etc.) but reduce the number of sections
- The expandable details pattern is good — keep it for truly optional deep dives
- Remove the "Short Version" block at the bottom (if the page is well-written, it shouldn't need a TL;DR of itself)

## Acceptance Criteria
- The page reads like a human wrote it
- The core concept is explained once, clearly
- The model work is given appropriate weight
- No self-referential meta-commentary
- Browser-verified

## Affected Files
- `app/about/page.tsx`
- `app/globals.css` (if layout changes)
