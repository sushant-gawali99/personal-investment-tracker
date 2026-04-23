import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolveFdCategories, FD_TXN_TYPE_TO_CATEGORY_NAME } from "./categories";

type Row = { id: string; userId: string | null; name: string; kind: string };

function makeFakeDb(initial: Row[]) {
  const rows = [...initial];
  let nextId = 100;
  return {
    rows,
    transactionCategory: {
      findMany: vi.fn(async (args: { where: { OR: Array<{ userId?: string | null }>; name: { in: string[] } } }) => {
        const { OR, name } = args.where;
        const allowedUserIds = OR.map((clause) => clause.userId);
        return rows.filter((r) => allowedUserIds.includes(r.userId) && name.in.includes(r.name));
      }),
      create: vi.fn(async (args: { data: Omit<Row, "id"> }) => {
        const row = { ...args.data, id: `new-${nextId++}` };
        rows.push(row);
        return row;
      }),
    },
  };
}

describe("resolveFdCategories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps all six fd txn types to category IDs", async () => {
    const db = makeFakeDb([]);
    const map = await resolveFdCategories(db as never, "user-1");
    expect(map.get("interest")).toBeTruthy();
    expect(map.get("maturity")).toBeTruthy();
    expect(map.get("premature_close")).toBe(map.get("maturity"));
    expect(map.get("tds")).toBeTruthy();
    expect(map.get("transfer_in")).toBe(map.get("transfer_out"));
    expect(map.get("other")).toBeUndefined();
  });

  it("reuses an existing user-scoped category with the same name", async () => {
    const db = makeFakeDb([
      { id: "existing-tds", userId: "user-1", name: "TDS", kind: "expense" },
    ]);
    const map = await resolveFdCategories(db as never, "user-1");
    expect(map.get("tds")).toBe("existing-tds");
    const createdNames = db.transactionCategory.create.mock.calls.map((c) => c[0].data.name);
    expect(createdNames).not.toContain("TDS");
    expect(createdNames).toContain("FD Interest");
    expect(createdNames).toContain("FD Maturity");
    expect(createdNames).toContain("Transfer");
  });

  it("reuses a preset (userId=null) category when present", async () => {
    const db = makeFakeDb([
      { id: "preset-transfer", userId: null, name: "Transfer", kind: "transfer" },
    ]);
    const map = await resolveFdCategories(db as never, "user-1");
    expect(map.get("transfer_in")).toBe("preset-transfer");
    expect(map.get("transfer_out")).toBe("preset-transfer");
  });

  it("creates new categories with the expected kind", async () => {
    const db = makeFakeDb([]);
    await resolveFdCategories(db as never, "user-1");
    const created = db.transactionCategory.create.mock.calls.map((c) => c[0].data);
    const byName = Object.fromEntries(created.map((r) => [r.name, r]));
    expect(byName["FD Interest"].kind).toBe("income");
    expect(byName["FD Maturity"].kind).toBe("income");
    expect(byName["TDS"].kind).toBe("expense");
    expect(byName["Transfer"].kind).toBe("transfer");
    for (const row of created) {
      expect(row.userId).toBe("user-1");
    }
  });

  it("exports a type→name mapping that covers all six types", () => {
    expect(Object.keys(FD_TXN_TYPE_TO_CATEGORY_NAME).sort()).toEqual([
      "interest", "maturity", "premature_close", "tds", "transfer_in", "transfer_out",
    ].sort());
  });
});
