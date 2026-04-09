import { Router } from "express";
import { eq, ilike, and, count, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import { requireAdmin, hashPassword } from "../lib/auth";
import { logActivity } from "../lib/activity";

const router: Router = Router();

router.get("/users", requireAdmin, async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const role = typeof req.query.role === "string" ? req.query.role : undefined;
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "20"), 10);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) conditions.push(ilike(usersTable.email, `%${search}%`));
  if (role) conditions.push(eq(usersTable.role, role as "super_admin" | "admin" | "client"));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [users, [{ total }]] = await Promise.all([
    db.select({
      id: usersTable.id,
      email: usersTable.email,
      username: usersTable.username,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    }).from(usersTable)
      .where(whereClause)
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(usersTable).where(whereClause),
  ]);

  res.json({ data: users, total: Number(total), page, limit });
});

router.post("/users", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { password, ...rest } = parsed.data;
  const passwordHash = await hashPassword(password);

  const [user] = await db.insert(usersTable).values({
    ...rest,
    passwordHash,
  }).returning({
    id: usersTable.id,
    email: usersTable.email,
    username: usersTable.username,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    role: usersTable.role,
    isActive: usersTable.isActive,
    createdAt: usersTable.createdAt,
  });

  await logActivity({
    req,
    userId: req.user?.userId,
    event: "user.created",
    description: `Admin created user ${user.email}`,
  });

  res.status(201).json(user);
});

router.get("/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [user] = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    username: usersTable.username,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    role: usersTable.role,
    isActive: usersTable.isActive,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.id, id));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ ...user, servers: [] });
});

router.patch("/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { password, ...updateData } = parsed.data;
  const updateFields: Record<string, unknown> = { ...updateData };

  if (password) {
    updateFields.passwordHash = await hashPassword(password);
  }

  const [user] = await db.update(usersTable)
    .set(updateFields)
    .where(eq(usersTable.id, id))
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      username: usersTable.username,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await logActivity({
    req,
    userId: req.user?.userId,
    event: "user.updated",
    description: `Admin updated user ${user.email}`,
  });

  res.json(user);
});

router.delete("/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [user] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning({ email: usersTable.email });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await logActivity({
    req,
    userId: req.user?.userId,
    event: "user.deleted",
    description: `Admin deleted user ${user.email}`,
  });

  res.sendStatus(204);
});

export default router;
