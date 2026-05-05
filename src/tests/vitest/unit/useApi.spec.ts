import { describe, expect, it } from "vitest";
import { createApiBaseURL } from "@/composables/useApi";

describe("createApiBaseURL", () => {
  it("VITE_API_DOMAIN_NAMEからhttpsのbaseURLを作る", () => {
    expect(createApiBaseURL("tools-api.mcre.info")).toBe(
      "https://tools-api.mcre.info",
    );
  });
});
