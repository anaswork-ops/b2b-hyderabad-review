# B2B Hyderabad V2 repository governance

Before implementation, read docs/source-of-truth/INDEX.md and these authorities in order:

1. docs/source-of-truth/FROZEN_REQUIREMENTS_SPECIFICATION.pdf (Markdown is a searchable transcription; PDF governs ambiguity).
2. docs/source-of-truth/TECHNOLOGY_BASELINE.md.
3. docs/source-of-truth/MASTER_CODEX_IMPLEMENTATION_PLAN.pdf (Markdown is a searchable transcription; PDF governs ambiguity).
4. docs/architecture/PROJECT_STRUCTURE.md (approved and frozen Step V physical architecture).
5. docs/handbook/DEVELOPER_HANDBOOK.md (Step VI approved and frozen).

Stop and report a material conflict; do not silently amend frozen requirements, technology, architecture, or phase scope. Read `docs/status/STEP_III_ENVIRONMENT_VALIDATION_REPORT.md` and `docs/status/STEP_III_VERSIONS.json` for exact Step III selections and their validation limits. They remain subordinate to the frozen technology lines. Summaries and conversation excerpts do not replace repository documents.

Codex may implement **only the currently authorized development phase**. Do not introduce unfrozen features. Engineering decisions are allowed only within the phase and frozen boundaries. A requirement or architecture change needs a recorded proposal and explicit user approval before incorporation.

At each phase end, run the required automated validation and produce the Phase Completion Report specified in the Master Plan, including results, deviations, limitations, and manual test instructions. Then **STOP FOR MANUAL USER TESTING**. Do not begin another phase until the user accepts the current one and explicitly authorizes the next.

Step IV and Step V are approved and frozen. Step VI was manually approved and frozen by the user on 2026-09-18. Development Phase 1 was manually tested, approved and frozen by the user on 2026-09-18 at checkpoint `36ad021`. Development Phase 2 was manually accepted and frozen by the user at checkpoint `cb62c51` on 2026-09-18. Development Phase 3 was manually tested, accepted and frozen by the user on 2026-09-21 at checkpoint `35da25b`. Development Phase 4 was manually tested, accepted and frozen by the user on 2026-09-21 at checkpoint `7b6966a`. Development Phase 5 was accepted and frozen by explicit user progression instruction on 2026-09-21 at checkpoint `789effe`. Development Phase 6 was explicitly authorized on 2026-09-21; its manual test gate remains mandatory.

On 2026-09-30 the Product Owner explicitly accepted Phase 7 and authorized Phase 8 development. Preserve the accepted Phase 7 working tree and all Phase 6 demo data. Phase 8 ends at manual MVP acceptance; v3 and Data Engineering expansion remain unauthorized.
