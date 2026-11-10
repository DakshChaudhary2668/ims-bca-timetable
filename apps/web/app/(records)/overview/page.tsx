import Link from "next/link";
import { buttonVariants } from "../../../components/ui/button";
import { loadResources } from "../../../lib/api";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const data = await loadResources([
    "academic-years",
    "semesters",
    "sections",
    "subjects",
    "faculty",
    "teaching-allocations",
  ]);
  const years = [...(data["academic-years"] ?? [])].sort((a, b) =>
    String(b.startsOn).localeCompare(String(a.startsOn)),
  );
  const metrics = [
    { label: "Academic years", count: years.length },
    { label: "Sections", count: data.sections?.length ?? 0 },
    {
      label: "Active faculty",
      count: data.faculty?.filter((row) => row.active).length ?? 0,
    },
    {
      label: "Teaching allocations",
      count: data["teaching-allocations"]?.length ?? 0,
    },
  ];

  return (
    <>
      <div className="page-heading heading-action">
        <div>
          <h1>Academic overview</h1>
          <p>
            Review the BCA programme register and prepare teaching allocations.
          </p>
        </div>
        <Link href="/setup" className={buttonVariants()}>
          Manage academic setup <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <dl className="metrics">
        {metrics.map(({ label, count }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
      <div className="dashboard-grid">
        <section
          aria-labelledby="register-title"
          className="panel register-panel"
        >
          <div className="panel-heading">
            <h2 id="register-title">Semester register</h2>
            <p>Sections and subjects by academic year.</p>
          </div>
          {years.length ? (
            years.map((year) => {
              const semesters =
                data.semesters
                  ?.filter((row) => row.academicYearId === year.id)
                  .sort((a, b) => Number(a.number) - Number(b.number)) ?? [];
              return (
                <div className="year-register" key={year.id}>
                  <h3>{year.name}</h3>
                  <p>
                    {String(year.startsOn).slice(0, 10)} to{" "}
                    {String(year.endsOn).slice(0, 10)}
                  </p>
                  {semesters.length ? (
                    <ul>
                      {semesters.map((semester) => {
                        const sections =
                          data.sections
                            ?.filter((row) => row.semesterId === semester.id)
                            .map((row) => row.name)
                            .sort() ?? [];
                        const subjects =
                          data.subjects?.filter(
                            (row) => row.semesterId === semester.id,
                          ).length ?? 0;
                        return (
                          <li key={semester.id}>
                            <strong>Semester {semester.number}</strong>
                            <span>
                              {sections.length
                                ? `Sections ${sections.join(", ")}`
                                : "No sections"}
                            </span>
                            <span>
                              {subjects}{" "}
                              {subjects === 1 ? "subject" : "subjects"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p>No semesters added.</p>
                  )}
                </div>
              );
            })
          ) : (
            <div className="register-empty">
              <strong>No academic years yet</strong>
              <p>
                Add an academic year to start organising semesters and sections.
              </p>
              <Link href="/setup#academic-years">
                Open academic years <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </section>
        <aside className="panel" aria-labelledby="work-title">
          <div className="panel-heading">
            <h2 id="work-title">Academic records</h2>
            <p>Open a register to view or update its entries.</p>
          </div>
          <Link className="work-link" href="/setup">
            <span>
              <strong>Academic setup</strong>
              <small>Years, semesters and sections</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
          <Link className="work-link" href="/faculty">
            <span>
              <strong>Faculty management</strong>
              <small>Directory, eligibility and allocations</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
          <Link className="work-link" href="/subjects">
            <span>
              <strong>Subjects and requirements</strong>
              <small>Subject register and lecture quotas</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        </aside>
      </div>
    </>
  );
}
