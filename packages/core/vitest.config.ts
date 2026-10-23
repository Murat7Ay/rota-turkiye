import { defineConfig } from "vitest/config";

// Makine yük altındayken testler en fazla 2 işçiyle koşar; CI'da da yeterince hızlı.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    pool: "threads",
    maxWorkers: 2,
    reporters: ["dot"],
  },
});
