"use strict";

// ---------- Floor layouts ----------
// Every floor is drawn by hand with the boss room along the bottom edge (see MAPS in map.js). Each time a floor is built it is turned
// one of eight ways: mirrored left to right, flipped upside down, and/or turned a quarter (rows and columns swapped). The same map
// then has the boss room at the bottom, the top, the left or the right, and the start on the opposite side or in another corner.
// The turned maps are cheap to make, so nothing is kept except the rows.

const LAYOUT = { force: null };   // a number from 0 to 7 makes every floor use that turn (for testing and the developer mode)

// bit 1 mirrors left to right, bit 2 flips top to bottom, bit 4 swaps rows and columns. 0 is the map as it was drawn.
function turnRows(rows, turn) {
  let g = rows.map(row => [...row]);
  if (turn & 4) g = g[0].map((_, x) => g.map(row => row[x]));
  if (turn & 2) g.reverse();
  if (turn & 1) g = g.map(row => row.slice().reverse());
  return g.map(row => row.join(''));
}

// The map to build for this visit: the original, or a copy with turned rows (without the picture of the original floor).
function layoutOf(map) {
  const turn = LAYOUT.force ?? Math.floor(Math.random() * 8);
  if (turn === 0) return map;
  const turned = map.turned || (map.turned = {});
  return { ...map, rows: turned[turn] || (turned[turn] = turnRows(map.rows, turn)), canvas: undefined, turned: undefined, turn };
}
