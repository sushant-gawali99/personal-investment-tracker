import { describe, it, expect } from "vitest";
import { isSupAdmin, SUPER_ADMIN_EMAIL } from "./session";

describe("isSupAdmin", () => {
  it("returns true for the super admin email", () => {
    expect(isSupAdmin(SUPER_ADMIN_EMAIL)).toBe(true);
  });
  it("returns false for any other email", () => {
    expect(isSupAdmin("other@example.com")).toBe(false);
  });
  it("returns false for null", () => {
    expect(isSupAdmin(null)).toBe(false);
  });
});
