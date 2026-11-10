# Substitution engine

**Planned.** Implement in the existing Node.js API after date-specific schedules and approval records exist. There are no production absence, substitute, approval, or daily schedule tables or endpoints today. The current Daily view reads the recurring weekly template.

1. Resolve affected classes for the campus date against the approved dated schedule or its pinned weekly version. Record the source revision.
2. Exclude absent and inactive faculty, unavailable or unconfirmed candidates under the agreed policy, overlapping teaching or cover, and any candidate failing adjacency or workload checks. Examine the full interval and other substitutions on the same date. Apply the PL's protected break adjacency policy.
3. Rank faculty eligible for the same subject first. If no candidate qualifies, optionally offer classroom coverage if the PL has approved it. Keep coverage distinct from qualified subject teaching. Leave the class unresolved when no valid candidate is available.
4. Persist a proposal for PL review. Approval must check authorization, source revision, availability, adjacency, workload and conflicts again within the write transaction. A competing approval or timetable update must cause revalidation or a stale response. Rejection or an unresolved case leaves the approved schedule unchanged.
5. Record the decision actor and time and preserve prior published schedules. Future exports reflect the approved dated version. Circulation on WhatsApp is manual.

Three regular classes per day are separate from the unconfirmed total including substitutions. An unset total does not permit a fourth period. Keep approval blocked when the applicable workload policy cannot be determined. Do not reuse the weekly validator's nullable cap as permission.

Cover partial-day absence, adjacent slots separated by breaks or gaps, split and whole-section sessions, concurrent proposals for the same faculty, edits after proposal generation, and holidays or cancellations. Faculty eligibility can change between proposal and approval. See [business rules](BUSINESS_RULES.md).
