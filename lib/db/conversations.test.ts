/* eslint-disable @typescript-eslint/no-explicit-any -- structural fake of the
   Supabase query builder; `any` keeps the chainable test double concise. */
import { describe, it, expect, vi } from "vitest";
import {
  listConversations,
  createConversation,
  getConversation,
  deleteConversation,
  touchConversation,
} from "@/lib/db/conversations";

function fakeDb(returnData: unknown) {
  const filters: Record<string, unknown> = {};
  const builder: any = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn((col: string, val: unknown) => {
      filters[col] = val;
      return builder;
    }),
    order: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: returnData, error: null })),
    then: undefined,
  };
  // make the builder awaitable for list queries
  builder.then = (resolve: (v: unknown) => void) =>
    resolve({ data: returnData, error: null });
  return {
    from: vi.fn(() => builder),
    _filters: filters,
    _builder: builder,
  };
}

describe("listConversations", () => {
  it("scopes the query to the given user id", async () => {
    const db = fakeDb([{ id: "c1", user_id: "user_1" }]);
    const result = await listConversations("user_1", db as any);
    expect(db.from).toHaveBeenCalledWith("conversations");
    expect(db._filters.user_id).toBe("user_1");
    expect(result).toEqual([{ id: "c1", user_id: "user_1" }]);
  });
});

describe("createConversation", () => {
  it("inserts a row carrying the user id and persona", async () => {
    const row = { id: "c2", user_id: "user_1", persona: "piyush" };
    const db = fakeDb(row);
    const result = await createConversation("user_1", "piyush", "Hello", db as any);
    expect(db._builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user_1", persona: "piyush", title: "Hello" }),
    );
    expect(result).toEqual(row);
  });
});

describe("getConversation", () => {
  it("scopes the lookup to the given user id and conversation id", async () => {
    const row = { id: "c1", user_id: "user_1", persona: "hitesh" };
    const db = fakeDb(row);
    const result = await getConversation("user_1", "c1", db as any);
    expect(db.from).toHaveBeenCalledWith("conversations");
    expect(db._filters.user_id).toBe("user_1");
    expect(db._filters.id).toBe("c1");
    expect(result).toEqual(row);
  });
});

describe("deleteConversation", () => {
  it("scopes the delete to the given user id and conversation id", async () => {
    const db = fakeDb(null);
    await deleteConversation("user_1", "c1", db as any);
    expect(db._builder.delete).toHaveBeenCalled();
    expect(db._filters.user_id).toBe("user_1");
    expect(db._filters.id).toBe("c1");
  });
});

describe("touchConversation", () => {
  it("scopes the update to the given user id and conversation id", async () => {
    const db = fakeDb(null);
    await touchConversation("user_1", "c1", db as any);
    expect(db._builder.update).toHaveBeenCalled();
    expect(db._filters.user_id).toBe("user_1");
    expect(db._filters.id).toBe("c1");
  });
});
