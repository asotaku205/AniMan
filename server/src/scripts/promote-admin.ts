import dataSource from "../database/data-source.js";
import { User } from "../users/user.entity.js";
import { UsersService } from "../users/users.service.js";

async function main(): Promise<void> {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "Set ADMIN_USERNAME and ADMIN_PASSWORD in server/.env before promoting an account",
    );
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username) || password.length < 6) {
    throw new Error("Admin username or password does not meet account rules");
  }

  await dataSource.initialize();
  try {
    const usersService = new UsersService(dataSource.getRepository(User));
    const admin = await usersService.promoteToAdmin(username, password);
    console.info(`Admin role granted to ${admin.username}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Admin promotion failed.",
  );
  process.exitCode = 1;
});
