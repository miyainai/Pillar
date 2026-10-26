import { defineConfig } from "vitest/config";

// Unit tests do not start a web service or need workflow port variables.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
