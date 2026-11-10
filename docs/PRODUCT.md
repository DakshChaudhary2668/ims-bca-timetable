# Product

IMS Ghaziabad UCC uses this workspace to manage BCA teaching allocations and weekly timetables. The Programme Leader (PL) owns schedule review and publication. A coordinator may prepare drafts if delegated. Daksh leads integration, Harry owns solver development, and Priyanshu supports UI and QA.

## Confirmed product requirements

Keep the PL in control of publication, preserve published history, and use the same academic records across semesters. Support whole-section and batch teaching. Keep draft generation separate from publication. Manual circular sharing is required once the dated workflow exists.

## MVP today

- Maintain academic years, semesters, sections, batches, subjects, quotas, faculty, rooms, weekly slots and availability.
- Assemble a shared weekly timetable manually. Inspect it by section, faculty, room, or weekday.
- Validate server-side and publish a version explicitly under an authorized operator identity. Preserve publication history and support browser print/PDF.

The BCA programme has six semester numbers. The earlier odd-session brief used semesters 1, 3 and 5 and example sections A–D. Actual offerings, dates, sections and slots come from the academic register. Sections may have whole-section teaching and configured batches.

## Follow-on work

The Python generator will propose a draft for human review. Date-specific schedules, attendance or absence records, substitution approval and PNG circular export are planned. Manual WhatsApp circulation remains a product requirement. WhatsApp integration, automated email without approval, auto-publication and a separate substitution service are outside scope.

See the [current evidence](IMPLEMENTATION_STATUS.md) and [unresolved PL decisions](BUSINESS_RULES.md#pl-decisions).
