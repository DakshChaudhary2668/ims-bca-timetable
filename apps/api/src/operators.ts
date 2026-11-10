import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { z } from "zod";

export const operatorConfig = z
  .array(
    z.strictObject({
      id: z.string().trim().min(1).max(120),
      token: z.string().regex(/^[A-Za-z0-9_-]{32,}$/),
      publish: z.boolean().default(false),
    }),
  )
  .superRefine((operators, ctx) => {
    for (const key of ["id", "token"] as const) {
      if (
        new Set(operators.map((operator) => operator[key])).size !==
        operators.length
      )
        ctx.addIssue({
          code: "custom",
          message: `Operator ${key}s must be unique.`,
        });
    }
  });

export type Operator = z.infer<typeof operatorConfig>[number];
const digest = (token: string) => createHash("sha256").update(token).digest();

export function authenticate(operators: Operator[]): RequestHandler {
  const configured = operators.map(({ id, token, publish }) => ({
    id,
    publish,
    hash: digest(token),
  }));
  return (req, res, next) => {
    const authorization = req.get("authorization");
    if (authorization?.startsWith("Bearer ")) {
      const token = digest(authorization.slice(7));
      const operator = configured.find(({ hash }) =>
        timingSafeEqual(hash, token),
      );
      if (operator)
        res.locals.operator = { id: operator.id, publish: operator.publish };
    }
    next();
  };
}

export const requireOperator: RequestHandler = (_req, res, next) => {
  if (res.locals.operator) {
    next();
    return;
  }
  res.status(401).json({ error: { message: "Sign in with an operator key." } });
};
