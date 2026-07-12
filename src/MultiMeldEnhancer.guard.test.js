import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("pending pickup lookup requires both a room and authenticated user", async () => {
  const source = await readFile(new URL("./MultiMeldEnhancer.jsx", import.meta.url), "utf8");

  assert.match(
    source,
    /const pendingPickup = room && uid && room\.publicState\?\.pendingDiscardPickup\?\.uid === uid/,
  );
  assert.doesNotMatch(
    source,
    /room\?\.publicState\?\.pendingDiscardPickup\?\.uid === uid\s*\?\s*room\.publicState\.pendingDiscardPickup/,
  );
});
