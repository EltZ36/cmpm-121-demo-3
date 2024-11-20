// todo
import "./style.css";
// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet, { Rectangle } from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
// import { Cell, IMapLib } from "./index.d.ts";

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
    drawLine();
    regenerateCache();
  });
  app.append(movementButton);
});

const resetButton = makeButton("🚮", () => {
  resetCaches();
});
const locationButton = makeButton("🌐", () => {
  showLocation();
});

app.append(resetButton, locationButton);

function goDirection(direction: string) {
  const offset = directionOffsets[direction];
  if (offset) {
    const latLng = playerMarker.getLatLng();
    playerMarker.setLatLng([
      latLng.lat + offset.lat,
      latLng.lng + offset.lng,
    ]);
    //make the map move with the player
    map.setView(latLng);
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

/*const knownGridCells: Map<string, Cell> = new Map();
// Use a record to store coins
const playerInventory: Record<string, string> = {};

// Cache storage, using a Record structure
const cacheStorage: Record<string, string[]> = {};*/
//const playerLine = leaflet.polyline([playerMarker.getLatLng()], {color: 'red'}).addTo(map);

const [playerInventory, cacheStorage, knownGridCells, playerLine] =
  loadFromLocalStorage();

playerLine.setStyle({ weight: 5 });

function drawLine() {
  playerLine.addLatLng([
    playerMarker.getLatLng().lat,
    playerMarker.getLatLng().lng,
  ]);
}

function clearRecord<K extends string, V>(record: Record<K, V>): void {
  (Object.keys(record) as K[]).forEach((key) => {
    delete record[key];
  });
}

function resetCaches() {
  const resetPrompt = prompt("Do you want to reset the map?");
  if (resetPrompt != null) {
    console.log("Resetting caches");
    clearRecord(playerInventory);
    clearRecord(cacheStorage);
    knownGridCells.clear();
    playerLine.setLatLngs([]);
    playerMarker.setLatLng(OAKES_CLASSROOM);
    localStorage.clear();
    clearCacheLayers();
    createCaches(playerMarker.getLatLng().lat, playerMarker.getLatLng().lng);
  }
}

function success(pos: GeolocationPosition) {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  playerMarker.setLatLng([lat, lng]);
  map.setView([lat, lng], map.getZoom());
  console.log(`found you! at ${lat} ${lng}`);
}

function showLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(success, function (error) {
      console.error("Error Code: " + error.code + " - " + error.message);
    }, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000,
    });
    // Optional: stop watching after a certain condition
    // navigator.geolocation.clearWatch(watchId);
  } else {
    alert("Geolocation is not supported by this browser.");
  }
}

const convertLatLngToGridCell = (
  latitude: number,
  longitude: number,
): Cell => ({
  i: Math.floor((latitude - OAKES_CLASSROOM.lat) / TILE_DEGREES),
  j: Math.floor((longitude - OAKES_CLASSROOM.lng) / TILE_DEGREES),
});

function getOrAddCanonicalGridCell(cell: Cell): Cell {
  const cellKey = `${cell.i},${cell.j}`;
  if (!knownGridCells.has(cellKey)) {
    knownGridCells.set(cellKey, cell);
  }
  return knownGridCells.get(cellKey)!;
}

function generateRandomCoinIdentifier(
  i: number,
  j: number,
  serialSeed: number,
): number {
  // Use the 'luck' function to get a more random number
  const randomValue = Math.floor(
    luck([i, j, "serial", serialSeed].toString()) * 100000,
  );
  return randomValue;
}

const createCoinIdentifier = (i: number, j: number, serial: number): string =>
  `${i}:${j}#${generateRandomCoinIdentifier(i, j, serial)}`;

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

function popButton(
  popupDiv: HTMLDivElement,
  inventoryDisplay: HTMLDivElement,
  popupSpan: HTMLSpanElement,
  cacheKey: string,
) {
  popupDiv.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
    "click",
    () => depositCoins(cacheKey, popupSpan, inventoryDisplay),
  );

  popupDiv.querySelector<HTMLButtonElement>("#withdraw")!.addEventListener(
    "click",
    () => withdrawCoins(cacheKey, popupSpan, inventoryDisplay),
  );
}

function depositCoins(
  cacheKey: string,
  popupSpan: HTMLSpanElement,
  inventoryDisplay: HTMLDivElement,
) {
  const playerCoins = Object.keys(playerInventory);
  if (playerCoins.length > 0) {
    const coin = playerInventory[playerCoins[0]];
    depositCoinIntoCache(cacheKey, coin);
    updateCoinDisplay(popupSpan, cacheKey, inventoryDisplay);
  }
}

function withdrawCoins(
  cacheKey: string,
  popupSpan: HTMLSpanElement,
  inventoryDisplay: HTMLDivElement,
) {
  if (cacheStorage[cacheKey]?.length > 0) {
    const coin = cacheStorage[cacheKey][0];
    withdrawCoinFromCache(cacheKey, coin);
    updateCoinDisplay(popupSpan, cacheKey, inventoryDisplay);
  }
}

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
  //idea for cache layers comes from CJ Moshy on https://github.com/CJMoshy/cmpm-121-demo-3/blob/main/src/main.ts lines 221 to 222
  activeCacheLayers.add(rect);

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

    popButton(popupDiv, inventoryDisplay, popupSpan, cacheKey);
    return popupDiv;
  });
};

// Track active cache layers
const activeCacheLayers: Set<Rectangle> = new Set();

// Function to remove all current cache layers
function clearCacheLayers() {
  activeCacheLayers.forEach((layer) => {
    LeafletAdapter.removeLayer(layer);
  });
  activeCacheLayers.clear();
}

function toMemento<T>(x: T): string {
  return JSON.stringify(x);
}

function fromMemento(state: string) {
  const parsed = JSON.parse(state);
  return parsed;
}

function saveToLocalStorage(): void {
  localStorage.setItem("knownGridCells", toMemento(knownGridCells));
  localStorage.setItem("cacheStorage", toMemento(cacheStorage));
  localStorage.setItem("playerInventory", toMemento(playerInventory));
  localStorage.setItem("playerLine", toMemento(playerLine.getLatLngs()));
}

//saveToLocalStorage and loadfromLocalStorage done with the help of CJ Moshy
function loadFromLocalStorage(): [
  Record<string, string>,
  Record<string, string[]>,
  Map<string, Cell>,
  leaflet.Polyline,
] {
  let knownGridCells: Map<string, Cell> = new Map();
  // Use a record to store coins
  let playerInventory: Record<string, string> = {};
  // Cache storage, using a Record structure
  let cacheStorage: Record<string, string[]> = {};
  const playerLine = leaflet.polyline([playerMarker.getLatLng()], {
    color: "red",
  }).addTo(map);
  const _knownGridCells = localStorage.getItem("knownGridCells");
  const _cacheStorage = localStorage.getItem("cacheStorage");
  const _playerInventory = localStorage.getItem("playerInventory");
  const _playerLine = localStorage.getItem("playerLine");

  if (_knownGridCells) {
    knownGridCells = new Map([fromMemento(_knownGridCells)]);
  }
  if (_playerInventory) {
    playerInventory = fromMemento(_playerInventory);
  }
  if (_cacheStorage) {
    cacheStorage = fromMemento(_cacheStorage);
  }
  if (_playerLine) {
    playerLine.setLatLngs([fromMemento(_playerLine)]);
  }

  return [playerInventory, cacheStorage, knownGridCells, playerLine];
}

// Regenerate cache function that uses save/restore mechanics
function regenerateCache() {
  clearCacheLayers();
  const playerPos = playerMarker.getLatLng();
  saveToLocalStorage();
  createCaches(playerPos.lat, playerPos.lng);
}

function createCaches(playerLat: number, playerLng: number) {
  const playerCell = convertLatLngToGridCell(playerLat, playerLng);

  for (
    let i = playerCell.i - NEIGHBORHOOD_SIZE;
    i <= playerCell.i + NEIGHBORHOOD_SIZE;
    i++
  ) {
    for (
      let j = playerCell.j - NEIGHBORHOOD_SIZE;
      j <= playerCell.j + NEIGHBORHOOD_SIZE;
      j++
    ) {
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        addCacheToMap(i, j);
      }
    }
  }
}

createCaches(OAKES_CLASSROOM.lat, OAKES_CLASSROOM.lng);
