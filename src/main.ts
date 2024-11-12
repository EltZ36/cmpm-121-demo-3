// todo
import "./style.css";
// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

// Location of our classroom (as identified on Google Maps)
const NULL_ISLAND = leaflet.latLng(0, 0);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Create the map (element with id "map" is defined in index.html)
const map = leaflet.map(document.getElementById("map")!, {
  center: NULL_ISLAND,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add a marker to represent the player
const playerMarker = leaflet.marker(NULL_ISLAND);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Display the player's points
let playerCoins = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!; // element `statusPanel` is defined in index.html
statusPanel.innerHTML = "No points yet...";

const knownCells: Map<string, Cell> = new Map();

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number) {
  getCanonicalCell({ i, j });
  // Convert cell numbers into lat/lng bounds
  const origin = NULL_ISLAND;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  //from brace
  const cacheCoins = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
  const coins = Array(cacheCoins).fill(0).map((_, serial) =>
    createCoin(i, j, serial)
  );

  // Handle interactions with the cache
  rect.bindPopup(() => {
    // Each cache has a random point value, mutable by the player
    let cacheCoins = Math.floor(luck([i, j, "initialValue"].toString()) * 100);

    // The popup offers a description and button
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>There is a cache here at "${i},${j}". It has value <span id="value">${
      coins.join(", ")
    }</span>.</div>
                <button id="deposit">deposit</button>
                <button id="withdraw">withdraw</button>`;

    // Clicking the button decrements the cache's value and increments the player's points
    popupDiv.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
      "click",
      () => {
        if (playerCoins > 0) {
          cacheCoins++;
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            cacheCoins.toString();
          playerCoins--;
          statusPanel.innerHTML =
            `deposit successful! you currently have ${playerCoins} point(s)`;
        }
      },
    );

    popupDiv.querySelector<HTMLButtonElement>("#withdraw")!.addEventListener(
      "click",
      () => {
        if (cacheCoins > 0) {
          cacheCoins--;
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            cacheCoins.toString();
          playerCoins++;
          statusPanel.innerHTML =
            `withdraw successful! you currently have ${playerCoins} point(s)`;
        }
      },
    );

    return popupDiv;
  });
}

function latLngToGridCell(lat: number, lng: number): Cell {
  return {
    i: Math.floor(lat / TILE_DEGREES),
    j: Math.floor(lng / TILE_DEGREES),
  };
}

function getCanonicalCell(cell: Cell): Cell {
  const { i, j } = cell;
  const key = [i, j].toString();
  if (!knownCells.has(key)) {
    knownCells.set(key, cell);
  }
  return knownCells.get(key)!;
}

// Function to create a coin at a specific grid cell with a serial
function createCoin(i: number, j: number, serial: number) {
  return `${i}:${j}#${serial}`;
}

function start() {
  // Look around the player's neighborhood for caches to spawn
  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
      // If location i,j is lucky enough, spawn a cache!
      latLngToGridCell(i, j);
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(i, j);
      }
    }
  }
}

start();
