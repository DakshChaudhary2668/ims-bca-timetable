import { notFound } from "next/navigation";
import { Records } from "../../../components/records";
import { loadResources } from "../../../lib/api";
import { resources, screens, type Resource } from "../../../lib/resources";

export const dynamic = "force-dynamic";

export default async function Screen({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!Object.hasOwn(screens, screen)) notFound();
  const config = screens[screen as keyof typeof screens];
  const needed = new Set<Resource>(config.resources);
  for (const resource of needed) {
    for (const { ref } of resources[resource].fields) if (ref) needed.add(ref);
  }

  const data = await loadResources([...needed]);
  return (
    <>
      <div className="page-heading">
        <h1>{config.title}</h1>
        <p>{config.description}</p>
      </div>
      <nav className="section-tabs" aria-label="Record sections">
        {config.resources.map((name) => (
          <a key={name} href={`#${name}`}>
            {resources[name].title}
          </a>
        ))}
      </nav>
      {config.resources.map((name) => (
        <Records key={name} name={name} data={data} />
      ))}
    </>
  );
}
