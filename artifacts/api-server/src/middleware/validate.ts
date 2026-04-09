import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";

/**
 * Middleware factory that validates req.body against a Zod schema.
 * Returns 400 with formatted field errors on failure.
 */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        fields: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Parse a route param as an integer.
 * Returns 400 if the param is missing or non-numeric.
 */
export function parseIntParam(req: Request, res: Response, param: string): number | null {
  const raw = Array.isArray(req.params[param]) ? req.params[param][0] : req.params[param];
  const n = parseInt(raw ?? "", 10);
  if (Number.isNaN(n)) {
    res.status(400).json({ error: `Invalid ${param}: must be an integer` });
    return null;
  }
  return n;
}
