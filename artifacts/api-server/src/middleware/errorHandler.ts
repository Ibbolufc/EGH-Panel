import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { ProviderError } from "../providers/types";

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Global Express error handler.
 * All thrown errors and next(err) calls land here.
 */
export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? (err instanceof ProviderError ? err.statusCode : 500);

  logger.error(
    { err, method: req.method, url: req.url, statusCode },
    "Unhandled error",
  );

  res.status(statusCode).json({
    error: err.message ?? "An unexpected error occurred",
    code: err.code,
  });
}

/**
 * Wraps an async route handler so errors propagate to the error handler.
 */
export function asyncHandler<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
>(
  fn: (req: Request<P, ResBody, ReqBody>, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request<P, ResBody, ReqBody>, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

/**
 * 404 handler — must be registered after all routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
}
