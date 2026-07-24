---
target: confirm import page
total_score: 27
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
timestamp: 2026-07-24T19-19-01Z
slug: src-ui-confirmstep-tsx
---
Method: degraded mixed run (A: /root/confirm_design_assessment · B: parent fallback after /root/confirm_evidence_assessment stalled)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---:|---|
| 1 | Visibility of System Status | 3 | Step indicator and heading focus are strong; submitting state still does not describe the side-effect phase. |
| 2 | Match System / Real World | 3 | "Unsaved DatoCMS movie form" is excellent; the final step still says "import" more than "apply reviewed values." |
| 3 | User Control and Freedom | 3 | Back to review is clear, but the counts do not expose what they contain. |
| 4 | Consistency and Standards | 4 | DatoCMS Button, Section, tokenized surfaces, and modal step patterns are coherent. |
| 5 | Error Prevention | 3 | Save/publish confusion is prevented; draft/upload sequencing is not concrete enough. |
| 6 | Recognition Rather Than Recall | 2 | Editors must remember which fields, people, and images the summary counts represent. |
| 7 | Flexibility and Efficiency | 2 | Efficient for a short flow, but power editors cannot jump back to a specific review section. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm and restrained; the warning panel dominates the intent summary. |
| 9 | Error Recovery | 2 | Warns that drafts/uploads may remain, but does not say where or how to recover. |
| 10 | Help and Documentation | 2 | Safety copy helps, but cleanup guidance and operational sequence are thin. |
| **Total** | **27/40** | **Good, with confidence and recognition gaps at the final gate.** |

## Design Specificity Verdict

The Confirm import page is product-aligned but under-authored for the final moment. It fits the DatoCMS environment: calm typography, DatoCMS UI components, conservative token usage, and precise unsaved-form language. The primary action, "Apply to unsaved movie," is a strong product-specific decision because it avoids implying save or publish.

The weak point is that the page confirms counts rather than confirming the editor's decision. "7 field changes, 2 people to create, 1 person to reuse, 3 images to upload" could belong to almost any CMS importer. For this plugin, the final gate should reaffirm the selected movie and side-effect sequence: draft People and uploads may be created, selected values are applied to the unsaved DatoCMS form, and the editor still controls save/publish.

LLM assessment: native, calm, and safe, but not yet confidence-building enough for a high-stakes final action.

Deterministic scan: the CLI detector returned [] for src/ui/ConfirmStep.tsx. No source-level detector findings.

Visual evidence: browser DOM evidence confirmed the Confirm heading receives focus with tabIndex -1 after Continue, the action row uses flex-wrap, buttons are 48px tall, and no horizontal overflow was detected at the checked 1280px harness viewport. Overlay injection was not completed in this run because the evidence subagent stalled and the parent used DOM/browser evidence as fallback.

## Overall Impression

The page is competent and trustworthy, but a little too administrative. It tells editors that the action is safe from accidental publishing, which is the most important promise. It does not yet help them recognize the exact import intent without returning to Review. The biggest opportunity is to make the final step feel less like "here are four numbers" and more like "here is the controlled sequence you are about to run."

## What's Working

- The primary CTA is well named. "Apply to unsaved movie" is much safer than "Import," "Confirm," or "Save."
- Focus management is now thoughtful. Moving focus to the Confirm import heading supports keyboard and screen-reader users.
- The visual system is restrained and Dato-native. DatoCMS Button and Section components, tokenized colors, and simple spacing keep the screen from feeling like an embedded SaaS dashboard.
- The safety copy correctly preserves the editor's mental model: the plugin does not save or publish the movie.

## Priority Issues

### [P1] The final summary is too abstract for a high-stakes confirmation

Why it matters: Counts alone do not let editors verify intent. If they paused, got interrupted, or skimmed Review, they have to trust memory before clicking the final button.

Fix: Add a compact "You're applying this to..." line with movie title and TMDB ID, then expand the summary into grouped rows for selected fields, draft People, reused People, and uploads. Keep it compact, but show names or destinations where risk is highest.

Suggested command: `$impeccable clarify`

### [P1] Normal behavior and failure risk are merged into one warning panel

Why it matters: The first two safety paragraphs are reassurance. The third is a real failure-side-effect warning. Putting all three into one yellow warning block makes the whole action feel dangerous while making the actual risk less scannable.

Fix: Split into a neutral "What happens next" panel and a smaller warning row for "If something fails after drafts/uploads are created..."

Suggested command: `$impeccable layout`

### [P2] The side-effect sequence is honest but not concrete

Why it matters: Editors need to know what happens first. "Drafts or uploads may remain" is accurate, but it does not explain that people/uploads can be created before form values finish applying.

Fix: Use a short sequence: create draft People, upload selected images, apply selected values to the unsaved movie form. Then state that save/publish remains manual.

Suggested command: `$impeccable clarify`

### [P2] The submitting state under-communicates risk

Why it matters: "Preparing import" does not tell the editor whether anything has started yet. During an operation with possible partial side effects, vague progress text can create anxiety if the modal stalls.

Fix: If phase tracking is available, reflect the current phase. If it is not, use clearer action text like "Applying selected values..." and keep the side-effect note visible.

Suggested command: `$impeccable harden`

### [P3] The action area feels detached on tall layouts

Why it matters: The final buttons sit below a small content block with open space between decision and explanation. It is usable, but the final action does not feel visually bound to the consequence copy.

Fix: Pull the actions closer to the next-step/safety panel or use a subtle final action container that binds the decision to the explanation.

Suggested command: `$impeccable layout`

## Persona Red Flags

Jordan, first-time editor: Jordan understands that the movie will not be saved or published, which is good. They may not know where remaining draft People or uploaded images would live if the import fails. The sentence "those drafts or uploads may remain in DatoCMS" raises a cleanup question the UI does not answer.

Alex, power editor: Alex can move fast, but the confirm page does not help them audit quickly. Counts are too generic. They need to know whether the two draft People and three uploads are the expected ones without going back.

Priya, cautious content lead: Priya cares about editorial control and accidental publication. The copy protects against publish fear, but it does not sufficiently separate safe form updates from external records/assets that may be created.

## Minor Observations

- "Confirm import" is conventional but slightly misleading because the action is not a full save/publish import.
- "Check what will be created or applied" is accurate, but "created" deserves more specificity: draft People and uploads.
- The summary numbers are visually understated compared with the yellow safety block.
- The stepper is clear, though its active state has more visual weight than the small summary below it.
- Browser text extraction collapses definition-list label/value pairs such as "Field changes7"; the visual layout is fine, but the copy relies on visual spacing rather than textual separators.

## Questions to Consider

- What if the final screen were titled "Apply reviewed values" instead of "Confirm import"?
- What would make an editor confident enough to click without returning to Review?
- Should failure cleanup guidance appear on this screen, or only after an actual failure?
- Which matters more at this final moment: reassuring editors that publish is manual, or warning them that side effects may remain?
