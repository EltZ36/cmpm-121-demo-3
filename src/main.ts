// todo
import "./style.css";
// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// Import the IMapLib interface
import { IMapLib } from "./index.d.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;

// Location of our classroom (as identified on Google Maps)
const OAKES_CLASSROOM = { lat: 36.98949379578401, lng: -122.06277128548504 };

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Leaflet Adapter
const LeafletAdapter: IMapLib = {
  createMap(center, zoom, elementId) {
    return leaflet.map(document.getElementById(elementId)!, {
      center: leaflet.latLng(center.lat, center.lng),
      zoom: zoom,
      minZoom: zoom,
      maxZoom: zoom,
      zoomControl: false,
      scrollWheelZoom: false,
    });
  },
  createTileLayer(urlTemplate, options) {
    return leaflet.tileLayer(urlTemplate, options);
  },
  createMarker(position, tooltip) {
    const marker = leaflet.marker([position.lat, position.lng]);
    marker.bindTooltip(tooltip);
    return marker;
  },
  removeLayer(layer) {
    map.removeLayer(layer);
  },
  addLayer(layer) {
    map.addLayer(layer);
  },
  createRectangle(bounds: [leaflet.LatLngTuple, leaflet.LatLngTuple]) {
    return leaflet.rectangle(bounds);
  },
};

// Create the map using the adapter
const map = LeafletAdapter.createMap(
  OAKES_CLASSROOM,
  GAMEPLAY_ZOOM_LEVEL,
  "map",
);

const DIRECTIONS = ["⬆️", "⬇️", "⬅️", "➡️"];
const directionOffsets: { [direction: string]: { lat: number; lng: number } } =
  {
    "⬆️": { lat: TILE_DEGREES, lng: 0 },
    "⬇️": { lat: -TILE_DEGREES, lng: 0 },
    "⬅️": { lat: 0, lng: -TILE_DEGREES },
    "➡️": { lat: 0, lng: TILE_DEGREES },
  };

function makeButton(
  buttonDescription: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.innerHTML = buttonDescription;
  button.addEventListener("click", onClick);
  return button;
}

DIRECTIONS.forEach((element) => {
  const movementButton = makeButton(element, () => {
    goDirection(element);
    regenerateCache();
  });
  app.append(movementButton);
});

function goDirection(direction: string) {
  const offset = directionOffsets[direction];
  if (offset) {
    const latLng = playerMarker.getLatLng();
    playerMarker.setLatLng([
      latLng.lat + offset.lat,
      latLng.lng + offset.lng,
    ]);
  }
}

// Populate the map with a background tile layer
LeafletAdapter.createTileLayer(
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
).addTo(map);

// Add a marker to represent the player
const playerMarker = LeafletAdapter.createMarker(
  OAKES_CLASSROOM,
  "That's you!",
);
LeafletAdapter.addLayer(playerMarker);

// Display the player's points
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

interface GridCell {
  i: number;
  j: number;
}

const knownGridCells: Map<string, GridCell> = new Map();
// Use a record to store coins
const playerInventory: Record<string, string> = {};

// Cache storage, using a Record structure
const cacheStorage: Record<string, string[]> = {};

const convertLatLngToGridCell = (
  latitude: number,
  longitude: number,
): GridCell => ({
  i: Math.floor((latitude - OAKES_CLASSROOM.lat) / TILE_DEGREES),
  j: Math.floor((longitude - OAKES_CLASSROOM.lng) / TILE_DEGREES),
});

const getOrAddCanonicalGridCell = (cell: GridCell): GridCell => {
  const cellKey = `${cell.i},${cell.j}`;
  if (!knownGridCells.has(cellKey)) {
    knownGridCells.set(cellKey, cell);
  }
  return knownGridCells.get(cellKey)!;
};

const createCoinIdentifier = (i: number, j: number, serial: number): string =>
  `${i}:${j}#${serial}`;

const addCoinToPlayerInventory = (coin: string): void => {
  playerInventory[coin] = coin;
};

const removeCoinFromPlayerInventory = (coin: string): void => {
  delete playerInventory[coin];
};

const depositCoinIntoCache = (cacheKey: string, coin: string): void => {
  if (!cacheStorage[cacheKey]) {
    cacheStorage[cacheKey] = [];
  }

  cacheStorage[cacheKey].push(coin);
  removeCoinFromPlayerInventory(coin);
};

const withdrawCoinFromCache = (cacheKey: string, coin: string): void => {
  if (!cacheStorage[cacheKey]) return;

  cacheStorage[cacheKey] = cacheStorage[cacheKey].filter((storedCoin) =>
    storedCoin !== coin
  );
  addCoinToPlayerInventory(coin);
};

const updateCoinDisplay = (
  popupSpan: HTMLSpanElement,
  cacheKey: string,
  inventoryDisplay: HTMLDivElement,
): void => {
  popupSpan.innerHTML = (cacheStorage[cacheKey] || []).join(", ");
  inventoryDisplay.innerHTML = `Player Inventory: ${
    Object.keys(playerInventory).join(", ")
  }`;
};

// Add caches to the map by cell numbers
const addCacheToMap = (i: number, j: number): void => {
  const gridCell = convertLatLngToGridCell(i, j);
  const canonicalCell = getOrAddCanonicalGridCell({ i, j });
  const cacheKey = `${canonicalCell.i}:${canonicalCell.j}`;

  // Calculate bounds using nested arrays for LatLngBoundsLiteral
  const origin = OAKES_CLASSROOM;
  const bounds: [[number, number], [number, number]] = [
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ];

  // Add a rectangle to the map to represent the cache
  const rect = LeafletAdapter.createRectangle(bounds);
  LeafletAdapter.addLayer(rect);

  // Initialize cache coins
  const coinCount = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
  const coins = Array.from(
    { length: coinCount },
    (_, serial) => createCoinIdentifier(gridCell.i, gridCell.j, serial),
  );

  cacheStorage[cacheKey] = coins;

  // Handle interactions with the cache
  rect.bindPopup(() => {
    const coinsInCache = cacheStorage[cacheKey] || [];
    const popupDiv = document.createElement("div");

    popupDiv.innerHTML = `
      <div>There is a cache here at "${gridCell.i},${gridCell.j}". It has value <span id="value">${
      coinsInCache.join(", ")
    }</span>.</div>
      <button id="deposit">deposit</button>
      <button id="withdraw">withdraw</button>`;

    const popupSpan = popupDiv.querySelector<HTMLSpanElement>("#value")!;
    const inventoryDisplay = document.querySelector<HTMLDivElement>(
      "#statusPanel",
    )!;

    // Deposit a coin from player inventory to cache
    popupDiv.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
      "click",
      () => {
        const playerCoins = Object.keys(playerInventory);
        if (playerCoins.length > 0) {
          const coin = playerInventory[playerCoins[0]];
          depositCoinIntoCache(cacheKey, coin);
          updateCoinDisplay(popupSpan, cacheKey, inventoryDisplay);
        }
      },
    );

    // Withdraw a coin from cache to player inventory
    popupDiv.querySelector<HTMLButtonElement>("#withdraw")!.addEventListener(
      "click",
      () => {
        if (cacheStorage[cacheKey]?.length > 0) {
          const coin = cacheStorage[cacheKey][0];
          withdrawCoinFromCache(cacheKey, coin);
          updateCoinDisplay(popupSpan, cacheKey, inventoryDisplay);
        }
      },
    );

    return popupDiv;
  });
};

function regenerateCache() {
  initializeGame();
}

function initializeGame() {
  // Look around the player's neighborhood for caches to spawn
  for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
      // If location i,j is lucky enough, spawn a cache!
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        addCacheToMap(i, j);
      }
    }
  }
}

initializeGame();
