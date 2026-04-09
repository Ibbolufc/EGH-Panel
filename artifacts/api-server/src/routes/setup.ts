import { Router } from "express";
import { z } from "zod";
import { count } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { hashPassword, signToken } from "../lib/auth";
import { authLimiter } from "../middleware/rateLimiter";
import { asyncHandler } from "../middleware/errorHandler";
import { validateBody } from "../middleware/validate";

const router: Router = Router();

async function userExists(): Promise<boolean> {
  const [row] = await db.select({ value: count() }).from(usersTable);
  return row.value > 0;
}

/**
 * GET /api/setup/status
 * Public — no authentication required.
 * Returns { setupRequired: true } when zero users exist in the database,
 * { setupRequired: false } otherwise.  The frontend uses this to decide
 * whether to show the onboarding page or the normal login screen.
 */
router.get(
  "/setup/status",
  asyncHandler(async (_req, res) => {
    const exists = await userExists();
    res.json({ setupRequired: !exists });
  }),
);

const SetupBody = z.object({
  firstName: z.string().min(1, "First name is required").max(64),
  lastName: z.string().min(1, "Last name is required").max(64),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username may only contain letters, numbers, underscores, and hyphens",
    ),
  email: z.string().email("Must be a valid email address"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

/**
 * POST /api/setup/complete
 * Rate-limited (same budget as /auth/login).
 * Creates the first super_admin account and returns a JWT so the owner
 * is immediately authenticated.
 *
 * Security: the handler re-checks userExists() inside the transaction so
 * concurrent requests cannot both slip through.  Once any user row exists
 * this endpoint returns 403 forever.
 */
router.post(
  "/setup/complete",
  authLimiter,
  validateBody(SetupBody),
  asyncHandler(async (req, res) => {
    if (await userExists()) {
      res
        .status(403)
        .json({ error: "Setup has already been completed. Please log in." });
      return;
    }

    const { firstName, lastName, username, email, password } =
      req.body as z.infer<typeof SetupBody>;

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(usersTable)
      .values({
        firstName,
        lastName,
        username,
        email: email.toLowerCase().trim(),
        passwordHash,
        role: "super_admin",
        isActive: true,
      })
      .returning();

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  }),
);

export default router;
