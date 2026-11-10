import "dotenv/config";
import { z } from "zod";
import { createApp } from "./app.js";
import { operatorConfig } from "./operators.js";
import { connectDatabase } from "./database.js";

const env = z
  .object({
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  })
  .safeParse(process.env);

if (!env.success) {
  console.error(
    "Invalid API environment:",
    env.error.issues.map((issue) => issue.path.join(".")).join(", "),
  );
  process.exit(1);
}

const operators = (() => {
  try {
    return operatorConfig.parse(JSON.parse(process.env.IMS_OPERATORS ?? "[]"));
  } catch {
    console.error(
      "IMS_OPERATORS must contain valid, unique operator credentials.",
    );
    process.exit(1);
  }
})();

const db = connectDatabase(env.data.DATABASE_URL);
const server = createApp(db, operators).listen(
  env.data.PORT,
  "127.0.0.1",
  () => {
    console.info(`IMS API listening on http://127.0.0.1:${env.data.PORT}`);
  },
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close(() => void db.$disconnect()));
}
