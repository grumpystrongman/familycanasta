import test from "node:test";
import assert from "node:assert/strict";
import { chompOnlinePlayers, firstOpenChompSeat } from "./onlineRoom.js";

test("online Chompageddon players are ordered by monster seat", () => {
  const room = {
    members: {
      c: { uid: "c", seat: 2 },
      a: { uid: "a", seat: 0 },
      b: { uid: "b", seat: 1 },
    },
  };
  assert.deepEqual(chompOnlinePlayers(room).map((player) => player.uid), ["a", "b", "c"]);
});

test("online Chompageddon reuses the lowest empty monster seat", () => {
  const room = {
    members: {
      host: { uid: "host", seat: 0 },
      right: { uid: "right", seat: 3 },
    },
  };
  assert.equal(firstOpenChompSeat(room), 1);
});

test("online Chompageddon reports full rooms after four occupied seats", () => {
  const room = {
    members: Object.fromEntries(Array.from({ length: 4 }, (_, seat) => [`p${seat}`, { uid: `p${seat}`, seat }])),
  };
  assert.equal(firstOpenChompSeat(room), -1);
});
