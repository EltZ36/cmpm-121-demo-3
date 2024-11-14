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
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Create the map (element with id "map" is defined in index.html)
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
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
const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Display the player's points
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

const knownCells: Map<string, { i: number; j: number }> = new Map();

// Player's inventory, using a single object to store all owned coins
const playerInventory: { [coinKey: string]: string } = {};

// Cache storage, using an object structure
const cacheStorage: { [key: string]: string[] } = {};

function latLngToGridCell(lat: number, lng: number) {
  return {
    i: Math.floor((lat - OAKES_CLASSROOM.lat) / TILE_DEGREES),
    j: Math.floor((lng - OAKES_CLASSROOM.lng) / TILE_DEGREES),
  };
}

function getCanonicalCell(cell: { i: number; j: number }) {
  const { i, j } = cell;
  const key = [i, j].toString();
  if (!knownCells.has(key)) {
    knownCells.set(key, cell);
  }
  return knownCells.get(key)!;
}

// Function to create a coin for a specific grid cell with a serial
function createCoin(i: number, j: number, serial: number) {
  return `${i}:${j}#${serial}`;
}

// Adds a coin to player's inventory
function addCoinToInventory(coin: string) {
  playerInventory[coin] = coin;
}

// Deletes a coin from player's inventory
function removeCoinFromInventory(coin: string) {
  delete playerInventory[coin];
}

// Deposit a coin from player's inventory to a cache
function depositCoinToCache(cacheKey: string, coin: string) {
  if (!cacheStorage[cacheKey]) {
    cacheStorage[cacheKey] = [];
  }

  cacheStorage[cacheKey].push(coin);
  removeCoinFromInventory(coin);
}

// Withdraw a coin from a cache to the player's inventory
function withdrawCoinFromCache(cacheKey: string, coin: string) {
  if (!cacheStorage[cacheKey]) return;

  cacheStorage[cacheKey] = cacheStorage[cacheKey].filter((c) => c !== coin);
  addCoinToInventory(coin);
}

function updateCoinDisplay(
  popupSpan: HTMLSpanElement,
  cacheKey: string,
  inventoryDisplay: HTMLDivElement,
) {
  popupSpan.innerHTML = (cacheStorage[cacheKey] || []).join(", ");
  inventoryDisplay.innerHTML = `Player Inventory: ${
    Object.keys(playerInventory).join(", ")
  }`;
}

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number) {
  const convertedCell = latLngToGridCell(i, j);
  const cacheCell = getCanonicalCell({ i, j });
  const key = `${cacheCell.i}:${cacheCell.j}`;

  // Convert cell numbers into lat/lng bounds
  const origin = OAKES_CLASSROOM;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Initialize cache coins
  const cacheCoins = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
  const coins = Array.from(
    { length: cacheCoins },
    (_, serial) => createCoin(convertedCell.i, convertedCell.j, serial),
  );

  cacheStorage[key] = coins;

  // Handle interactions with the cache
  rect.bindPopup(() => {
    const coinsInCache = cacheStorage[key] || [];
    const popupDiv = document.createElement("div");

    popupDiv.innerHTML = `
      <div>There is a cache here at "${convertedCell.i},${convertedCell.j}". It has value <span id="value">${
      coinsInCache.join(", ")
    }</span>.</div>
      <button id="deposit">deposit</button>
      <button id="withdraw">withdraw</button>`;

    const popupSpan = popupDiv.querySelector<HTMLSpanElement>("#value")!;
    const inventoryDisplay = document.querySelector<HTMLDivElement>(
      "#statusPanel",
    )!;

    // Deposit from player inventory to cache
    popupDiv.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
      "click",
      () => {
        const coinKeys = Object.keys(playerInventory);
        if (coinKeys.length > 0) {
          const coin = playerInventory[coinKeys[0]];
          depositCoinToCache(key, coin);
          updateCoinDisplay(popupSpan, key, inventoryDisplay);
        }
      },
    );

    // Withdraw from cache to player inventory
    popupDiv.querySelector<HTMLButtonElement>("#withdraw")!.addEventListener(
      "click",
      () => {
        if (cacheStorage[key]?.length > 0) {
          const coin = cacheStorage[key][0];
          withdrawCoinFromCache(key, coin);
          updateCoinDisplay(popupSpan, key, inventoryDisplay);
        }
      },
    );

    return popupDiv;
  });
}

function main() {
  // Look around the player's neighborhood for caches to spawn
  for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
      // If location i,j is lucky enough, spawn a cache!
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(i, j);
      }
    }
  }
}

main();
