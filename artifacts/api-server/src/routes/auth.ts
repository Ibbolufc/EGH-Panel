import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, usersTable } from "@workspace/db";
import { requireAuth, hashPassword, comparePassword, signToken } from "../lib/auth";
import { logActivity } from "../lib/activity";
import { authLimiter } from "../middleware/rateLimiter";
import { asyncHandler } from "../middleware/errorHandler";
import { validateBody } from "../middleware/validate";

const router: Router = Router();

const LoginBody = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

const UpdateProfileBody = z.object({
  firstName: z.string().min(1).max(64).optional(),
  lastName: z.string().min(1).max(64).optional(),
  username: z.string().min(3).max(32).optional(),
});

function publicUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

router.post("/auth/login", authLimiter, validateBody(LoginBody), asyncHandler(async (req, res) => {
  const { email, password } = req.body as z.infer<typeof LoginBody>;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  await logActivity({
    req,
    userId: user.id,
    event: "auth.login",
    description: `User ${user.email} logged in`,
  });

  res.json({ token, user: publicUser(user) });
}));

router.post("/auth/logout", requireAuth, asyncHandler(async (req, res) => {
  await logActivity({
    req,
    userId: req.user?.userId,
    event: "auth.logout",
    description: `User ${req.user?.email} logged out`,
  });
  res.json({ message: "Logged out successfully" });
}));

router.get("/auth/me", requireAuth, asyncHandler(async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(publicUser(user));
}));

router.patch("/auth/me", requireAuth, validateBody(UpdateProfileBody), asyncHandler(async (req, res) => {
  const updates = req.body as z.infer<typeof UpdateProfileBody>;
  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.user!.userId))
    .returning();
  res.json(publicUser(user));
}));

router.patch("/auth/me/password", requireAuth, validateBody(ChangePasswordBody), asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body as z.infer<typeof ChangePasswordBody>;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  if (currentPassword === newPassword) {
    res.status(400).json({ error: "New password must be different from current password" });
    return;
  }

  const newHash = await hashPassword(newPassword);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));

  await logActivity({
    req,
    userId: user.id,
    event: "auth.password_changed",
    description: `User ${user.email} changed their password`,
  });

  res.json({ message: "Password changed successfully" });
}));

export default router;
