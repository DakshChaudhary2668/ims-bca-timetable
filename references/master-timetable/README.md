# Academic Scheduling

A browser-based timetable manager for IMS Ghaziabad, built from the supplied UI reference, workflow diagram and approved BCA master timetable.

## Open the app

Open `index.html` in a modern browser. It has no build step or package dependencies.

## Included

- BCA Semester 1, 3 and 5 timetables for Sections A–D, with section, faculty and room views.
- Faculty and room views put the selected instructor or room first, with the course shown underneath.
- Daily draft creation, faculty and room conflict checks, configurable consecutive-load validation, publish confirmation and detailed CSV export.
- Review every changed day, section and period against the published timetable before issuing a daily version.
- Print the selected section’s weekly timetable or save it as PDF from the browser’s print dialog.
- Print all four sections together in a landscape master timetable.
- Printed timetables identify the semester, section, selected week and published/draft status.
- Export either the selected section or all four sections in one detailed weekly CSV.
- Timetable CSV exports include mapped course codes alongside course names.
- CSV files use UTF-8 BOM encoding so Excel can read Indian names and punctuation reliably.
- Navigate timetable cells and controls with a keyboard, with visible focus and accessible cell labels.
- JSON backup and restore for admin changes and schedule versions.
- Absence lookup from the selected semester’s real faculty and section schedule, with same-course substitute availability checks.
- The absence form filters its faculty picker to instructors scheduled on the chosen day and period.
- The operations panel reflects the currently selected teaching week.
- Apply a holiday or campus closure to a weekday across all four sections in a daily draft, then review the change before publishing.
- Restore any weekday across all sections from the approved schedule to undo a closure or other day-level draft edits.
- Substitute recommendations exclude instructors who would exceed the configured consecutive-class limit.
- Admins can choose a free alternate instructor or enter a name when no same-course substitute is available; publishing checks the final load for conflicts.
- Revert an approved substitution from the operations list before issuing the daily version.
- Export current-week absence and substitute decisions with periods, sections, rooms and faculty names to CSV.
- Substitution records include the specific class period so multiple absences on one day remain distinguishable.
- Manual faculty assignment when a timetable class or subject mapping has no usable faculty match. Admins can select a listed instructor or enter a name for a section.
- Faculty, subject, batch and room listings from the master workbook.
- Faculty workload highlights unassigned timetable sessions and provides direct manual assignment controls.
- Weekly workload tables and CSVs break each instructor’s sessions down by weekday.
- Workload summaries rank faculty by sessions and highlight the highest weekly assignment count.
- Validation distinguishes faculty overlaps from sessions with no mapped faculty and points admins to the unresolved class.
- Conflict validation shows affected faculty, sections, days and periods directly on the timetable.
- The timetable conflict status refreshes quietly after changing the schedule, so it does not show stale results.
- Admins can set the maximum consecutive faculty load from 1–6 periods; the handwritten three-class limit is the default.
- The Reports page keeps a local, bounded audit log of schedule edits, faculty assignments, substitutions, rule changes, publishing and backup restores.
- Export the selected week’s audit trail to CSV for review outside the browser.
- Responsive pages for overview, academic setup, faculty workload, daily operations, reports and scheduling settings.
- Overview attendance desk lists the faculty directory by selected weekday and lets admins mark present, absent or late.
- Late arrival is marked by timetable hour. Classes scheduled before the selected arrival time enter an approval step where an admin assigns an available cover or postpones the class; approved changes appear in the daily timetable.
- Academic Setup can add faculty and edit subject-to-faculty assignments for each section. Workload and timetable views use the updated assignments.
- Attendance, faculty additions, postponed classes and approved daily cover assignments are included in local browser storage and JSON backup/restore.

## Master resource

`master-resource.js` contains the extracted timetable data from the workbook sheets `BCA I`, `BCA III` and `BCA V`, including the effective date, merged schedule cells, subject codes and names, faculty assignments, and room mappings.

Lunch periods are read from each semester sheet. The handwritten note’s limit of three consecutive faculty classes is applied during validation.

Daily edits, week-specific drafts and published schedules, manual faculty assignments, attendance records, absence records and week-specific substitutions are saved in the browser's local storage and remain after reloads in the same browser profile. They do not update the original workbook or sync across admin devices. Use Reports & Exports to download a JSON backup and restore it in another browser. Clearing this browser's site data removes its saved changes.

If browser storage is unavailable or full, changes remain active for the current session and the app reports that they were not saved for later.
