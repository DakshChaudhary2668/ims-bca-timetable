import { z } from "zod";
import { rowSchema, type Data, type Resource } from "./resources";

export function apiOrigin() {
  return z
    .url({ protocol: /^https?$/ })
    .parse(process.env.API_ORIGIN ?? "http://127.0.0.1:4000");
}

export async function loadResources(names: readonly Resource[]): Promise<Data> {
  const results = await Promise.all(
    names.map(async (name) => {
      const response = await fetch(new URL(`/api/${name}`, apiOrigin()), {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`Unable to load ${name}`);
      return [name, rowSchema.array().parse(await response.json())] as const;
    }),
  );
  return Object.fromEntries(results);
}
