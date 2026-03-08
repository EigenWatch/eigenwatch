import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/user/schema.prisma",
  migrations: {
    path: "prisma/user/migrations",
  },
  datasource: {
    url: env("USER_DATABASE_URL"),
  },
});
