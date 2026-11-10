import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export function connectDatabase(connectionString: string) {
  const schema =
    new URL(connectionString).searchParams.get("schema") ?? undefined;
  return new PrismaClient({
    adapter: new PrismaPg(
      { connectionString, connectionTimeoutMillis: 3000 },
      { schema },
    ),
  });
}
