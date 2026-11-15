import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { pointInGeometry } from "./geo.mjs";

const boundaryData = JSON.parse(await readFile(new URL("../config/administrative_boundaries.json", import.meta.url), "utf8"));
const boundaries = new Map(boundaryData.features.map((feature) => [
  `${feature.properties.country}\u0000${feature.properties.district}`,
  feature.geometry
]));

test("configured district and region centers are inside their polygons", () => {
  const centers = [
    ["Sri Lanka", "Colombo", 6.9271, 79.8612],
    ["Sri Lanka", "Gampaha", 7.0917, 79.993],
    ["Sri Lanka", "Kandy", 7.2906, 80.6337],
    ["Sri Lanka", "Galle", 6.0535, 80.221],
    ["Sri Lanka", "Anuradhapura", 8.3114, 80.4037],
    ["India", "Tamil Nadu", 13.0827, 80.2707],
    ["India", "Kerala", 9.9312, 76.2673],
    ["India", "Maharashtra", 19.076, 72.8777],
    ["India", "Odisha", 20.2961, 85.8245],
    ["Nepal", "Bagmati", 27.7172, 85.324],
    ["Nepal", "Gandaki", 28.2096, 83.9856],
    ["Bangladesh", "Dhaka", 23.8103, 90.4125],
    ["Bangladesh", "Khulna", 22.8456, 89.5403]
  ];

  for (const [country, district, lat, lon] of centers) {
    const geometry = boundaries.get(`${country}\u0000${district}`);
    assert.ok(geometry, `Missing polygon for ${country} / ${district}`);
    assert.equal(pointInGeometry(lon, lat, geometry), true, `${country} / ${district}`);
  }
});

test("a point in one district is rejected when assigned to another", () => {
  const kandy = boundaries.get("Sri Lanka\u0000Kandy");
  const colombo = boundaries.get("Sri Lanka\u0000Colombo");
  assert.equal(pointInGeometry(80.6337, 7.2906, kandy), true);
  assert.equal(pointInGeometry(80.6337, 7.2906, colombo), false);
});

test("polygon holes are excluded and boundary points are included", () => {
  const polygon = {
    type: "Polygon",
    coordinates: [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]]
    ]
  };
  assert.equal(pointInGeometry(1, 1, polygon), true);
  assert.equal(pointInGeometry(3, 3, polygon), false);
  assert.equal(pointInGeometry(0, 5, polygon), true);
});
