import { db } from "../../lib/db/src";
import {
  usersTable,
  nestsTable,
  eggsTable,
  eggVariablesTable,
  nodesTable,
  allocationsTable,
  serversTable,
  serverVariablesTable,
} from "../../lib/db/src/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding EGH Panel demo data...");

  // Users
  const adminHash = await bcrypt.hash("admin123", 12);
  const clientHash = await bcrypt.hash("client123", 12);

  const [superAdmin] = await db.insert(usersTable).values({
    email: "admin@eghpanel.com",
    username: "superadmin",
    firstName: "Super",
    lastName: "Admin",
    passwordHash: adminHash,
    role: "super_admin",
    isActive: true,
  }).onConflictDoNothing().returning();

  const [clientUser] = await db.insert(usersTable).values({
    email: "client@example.com",
    username: "demouser",
    firstName: "Demo",
    lastName: "Client",
    passwordHash: clientHash,
    role: "client",
    isActive: true,
  }).onConflictDoNothing().returning();

  const [adminUser] = await db.insert(usersTable).values({
    email: "admin2@eghpanel.com",
    username: "admin2",
    firstName: "Panel",
    lastName: "Admin",
    passwordHash: adminHash,
    role: "admin",
    isActive: true,
  }).onConflictDoNothing().returning();

  // Silence unused-variable warnings — users exist in DB even if not returned
  void superAdmin;
  void adminUser;

  console.log("Users seeded");

  // Nests
  const [minecraftNest] = await db.insert(nestsTable).values({
    name: "Minecraft",
    description: "Minecraft Java and Bedrock game servers",
  }).onConflictDoNothing().returning();

  const [sourceNest] = await db.insert(nestsTable).values({
    name: "Source Engine",
    description: "Source Engine games (CS2, TF2, etc.)",
  }).onConflictDoNothing().returning();

  const [rustNest] = await db.insert(nestsTable).values({
    name: "Rust",
    description: "Rust survival game servers",
  }).onConflictDoNothing().returning();

  console.log("Nests seeded");

  // Eggs
  if (minecraftNest) {
    const [vanillaEgg] = await db.insert(eggsTable).values({
      nestId: minecraftNest.id,
      name: "Vanilla Minecraft",
      description: "Standard Vanilla Minecraft server",
      dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
      dockerImages: ["ghcr.io/pterodactyl/yolks:java_21", "ghcr.io/pterodactyl/yolks:java_17"],
      startup: "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar --nogui",
      installScript: "#!/bin/bash\ncurl -o server.jar https://launcher.mojang.com/v1/objects/latest.jar",
    }).onConflictDoNothing().returning();

    if (vanillaEgg) {
      await db.insert(eggVariablesTable).values([
        {
          eggId: vanillaEgg.id,
          name: "Server Memory",
          description: "Maximum memory in MB",
          envVariable: "SERVER_MEMORY",
          defaultValue: "1024",
          userViewable: "true",
          userEditable: "true",
          rules: "required|numeric|between:512,16384",
        },
        {
          eggId: vanillaEgg.id,
          name: "Minecraft Version",
          description: "Minecraft server version",
          envVariable: "MC_VERSION",
          defaultValue: "latest",
          userViewable: "true",
          userEditable: "false",
          rules: "required|string",
        },
      ]).onConflictDoNothing();
    }

    await db.insert(eggsTable).values({
      nestId: minecraftNest.id,
      name: "Paper MC",
      description: "High performance fork of Spigot",
      dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
      startup: "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar paper.jar --nogui",
    }).onConflictDoNothing();
  }

  if (sourceNest) {
    await db.insert(eggsTable).values({
      nestId: sourceNest.id,
      name: "Counter-Strike 2",
      description: "CS2 dedicated game server",
      dockerImage: "ghcr.io/pterodactyl/games:source",
      startup: "./game/csgo/srcds_run -game csgo -console -ip 0.0.0.0 -port {{SERVER_PORT}}",
    }).onConflictDoNothing();

    await db.insert(eggsTable).values({
      nestId: sourceNest.id,
      name: "Team Fortress 2",
      description: "TF2 dedicated server",
      dockerImage: "ghcr.io/pterodactyl/games:source",
      startup: "./srcds_run -game tf -console -port {{SERVER_PORT}}",
    }).onConflictDoNothing();
  }

  if (rustNest) {
    await db.insert(eggsTable).values({
      nestId: rustNest.id,
      name: "Rust",
      description: "Official Rust dedicated server",
      dockerImage: "ghcr.io/pterodactyl/games:rust",
      startup: "./RustDedicated -batchmode -nographics +server.port {{SERVER_PORT}} +server.maxplayers 100",
    }).onConflictDoNothing();
  }

  console.log("Eggs seeded");

  // Nodes
  const [node1] = await db.insert(nodesTable).values({
    name: "US-East-1",
    fqdn: "node1.eghpanel.com",
    scheme: "https",
    daemonPort: 8080,
    isPublic: true,
    memoryTotal: 32768,
    memoryOverallocate: 0,
    diskTotal: 500000,
    diskOverallocate: 0,
    status: "online",
  }).onConflictDoNothing().returning();

  const [node2] = await db.insert(nodesTable).values({
    name: "EU-West-1",
    fqdn: "node2.eghpanel.com",
    scheme: "https",
    daemonPort: 8080,
    isPublic: true,
    memoryTotal: 65536,
    memoryOverallocate: 0,
    diskTotal: 1000000,
    diskOverallocate: 0,
    status: "online",
  }).onConflictDoNothing().returning();

  console.log("Nodes seeded");

  // Allocations
  if (node1) {
    const allocPorts = [25565, 25566, 25567, 27015, 27016, 28015];
    for (const port of allocPorts) {
      await db.insert(allocationsTable).values({
        nodeId: node1.id,
        ip: "192.168.1.10",
        port,
      }).onConflictDoNothing();
    }
  }

  if (node2) {
    const allocPorts = [25565, 25566, 27015, 27016];
    for (const port of allocPorts) {
      await db.insert(allocationsTable).values({
        nodeId: node2.id,
        ip: "10.0.0.20",
        port,
      }).onConflictDoNothing();
    }
  }

  console.log("Allocations seeded");

  // Demo servers (requires a seeded client user, node, and allocation)
  if (clientUser && node1) {
    // Pick the first allocation belonging to node1 for the demo server.
    const [firstAlloc] = await db
      .select()
      .from(allocationsTable)
      .where(eq(allocationsTable.nodeId, node1.id))
      .limit(1);

    const [firstEgg] = await db.select().from(eggsTable).limit(1);

    if (firstAlloc && firstEgg) {
      const [server] = await db.insert(serversTable).values({
        name: "My Minecraft Server",
        description: "Demo survival world",
        userId: clientUser.id,
        nodeId: node1.id,
        eggId: firstEgg.id,
        allocationId: firstAlloc.id,
        status: "running",
        memoryLimit: 2048,
        diskLimit: 10000,
        cpuLimit: 100,
        startup: firstEgg.startup,
        dockerImage: firstEgg.dockerImage,
      }).onConflictDoNothing().returning();

      if (server) {
        // Mark only the specific allocation as used by this server.
        await db
          .update(allocationsTable)
          .set({ serverId: server.id })
          .where(eq(allocationsTable.id, firstAlloc.id));

        await db.insert(serverVariablesTable).values({
          serverId: server.id,
          envVariable: "SERVER_MEMORY",
          value: "2048",
        }).onConflictDoNothing();
      }
    }
  }

  console.log("Seed complete!");
  console.log("---");
  console.log("Demo accounts:");
  console.log("  Super Admin: admin@eghpanel.com / admin123");
  console.log("  Admin:       admin2@eghpanel.com / admin123");
  console.log("  Client:      client@example.com / client123");
}

seed().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
