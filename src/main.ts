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
  getMarkerPosition(marker) {
    return marker.getLatLng();
  },
  setMarkerPosition(marker, position) {
    marker.setLatLng([position.lat, position.lng]);
  },
  updateMapView(lat, lng) {
    map.setView([lat, lng], map.getZoom());
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

const [playerInventory, cacheStorage, knownGridCells, playerLine] =
  loadFromLocalStorage();
playerLine.setStyle({ weight: 5 });

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
  createCaches(playerMarker.getLatLng().lat, playerMarker.getLatLng().lng);
  showLocation();
});

app.append(resetButton, locationButton);

// Call this function to save the location, e.g., after moving the player
function goDirection(direction: string) {
  const offset = directionOffsets[direction];
  if (offset) {
    const currentPosition = LeafletAdapter.getMarkerPosition(playerMarker);
    const newPosition = {
      lat: currentPosition.lat + offset.lat,
      lng: currentPosition.lng + offset.lng,
    };
    LeafletAdapter.setMarkerPosition(playerMarker, newPosition);
    LeafletAdapter.updateMapView(newPosition.lat, newPosition.lng);
    saveGameState();
  }
}

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
    saveGameState();
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
    saveGameState();
  }
}

// Display the player's points
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
if (getRecordLength(playerInventory) == 0) {
  statusPanel.innerHTML = "No points yet...";
} else {
  statusPanel.innerHTML = `Player Inventory: ${
    Object.keys(playerInventory).join(", ")
  }`;
}

function drawLine() {
  playerLine.addLatLng([
    playerMarker.getLatLng().lat,
    playerMarker.getLatLng().lng,
  ]);
}

function getRecordLength<K extends string, V>(record: Record<K, V>): number {
  return Object.keys(record).length;
}

function clearRecord<K extends string, V>(record: Record<K, V>): void {
  (Object.keys(record) as K[]).forEach((key) => {
    delete record[key];
  });
}

function resetCaches() {
  const shouldReset = confirmReset();
  if (shouldReset) {
    resetGameState();
    resetUI();
    saveGameStateAfterReset();
  }
}

function confirmReset(): boolean {
  const resetPrompt = prompt("Do you want to reset the map?");
  return resetPrompt != null;
}

function resetGameState(): void {
  clearRecord(playerInventory);
  clearRecord(cacheStorage);
  knownGridCells.clear();
  playerLine.setLatLngs([]);
  playerMarker.setLatLng(OAKES_CLASSROOM);
  clearCacheLayers();
}

function resetUI(): void {
  statusPanel.innerHTML = "No points yet...";
}

function saveGameStateAfterReset(): void {
  localStorage.clear();
  const playerLatLng = LeafletAdapter.getMarkerPosition(playerMarker);
  createCaches(playerLatLng.lat, playerLatLng.lng);
  saveGameState();
}

function showLocation() {
  if (navigator.geolocation) {
    const _watchId = navigator.geolocation.watchPosition(
      handlePositionUpdate(),
      handleError,
      getGeolocationOptions(),
    );
  } else {
    alert("Geolocation is not supported by this browser.");
  }
}

function handlePositionUpdate() {
  let lastPosition: { lat: number; lng: number } | null = null;

  return (position: GeolocationPosition) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    if (hasPositionChanged(lastPosition, lat, lng)) {
      updatePosition(lat, lng);
      createCaches(lat, lng);
      lastPosition = { lat, lng };
    }
  };
}

function updatePosition(lat: number, lng: number) {
  playerMarker.setLatLng([lat, lng]);
  saveGameState();
  map.setView([lat, lng], map.getZoom());
}

function hasPositionChanged(
  lastPosition: { lat: number; lng: number } | null,
  lat: number,
  lng: number,
): boolean {
  return !lastPosition || lastPosition.lat !== lat || lastPosition.lng !== lng;
}

function handleError(error: GeolocationPositionError) {
  console.error("Error Code: " + error.code + " - " + error.message);
}

function getGeolocationOptions() {
  return {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 5000,
  };
}

const convertLatLngToGridCell = (
  latitude: number,
  longitude: number,
): Cell => ({
  i: Math.floor((latitude - OAKES_CLASSROOM.lat) / TILE_DEGREES),
  j: Math.floor((longitude - OAKES_CLASSROOM.lng) / TILE_DEGREES),
});

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
  saveGameState();
};

const withdrawCoinFromCache = (cacheKey: string, coin: string): void => {
  if (!cacheStorage[cacheKey]) return;

  cacheStorage[cacheKey] = cacheStorage[cacheKey].filter((storedCoin) =>
    storedCoin !== coin
  );
  addCoinToPlayerInventory(coin);
  saveGameState();
};

const activeCacheLayers: Set<leaflet.Layer> = new Set();

function getCacheKey(gridCell: Cell): string {
  return `${gridCell.i}:${gridCell.j}`;
}

function calculateBounds(
  i: number,
  j: number,
): [[number, number], [number, number]] {
  return [
    [
      OAKES_CLASSROOM.lat + i * TILE_DEGREES,
      OAKES_CLASSROOM.lng + j * TILE_DEGREES,
    ],
    [
      OAKES_CLASSROOM.lat + (i + 1) * TILE_DEGREES,
      OAKES_CLASSROOM.lng + (j + 1) * TILE_DEGREES,
    ],
  ];
}

function addCacheLayer(i: number, j: number, cacheKey: string): void {
  const bounds = calculateBounds(i, j);
  const rect = LeafletAdapter.createRectangle(bounds);
  LeafletAdapter.addLayer(rect);
  activeCacheLayers.add(rect);

  rect.bindPopup(() => createPopup(cacheKey));
}

function addCacheToMap(i: number, j: number): void {
  const gridCell = convertLatLngToGridCell(i, j);
  const cacheKey = getCacheKey(gridCell);

  if (!(cacheKey in cacheStorage)) {
    initializeCacheStorage(cacheKey, gridCell);
  }

  addCacheLayer(i, j, cacheKey);
}

function initializeCacheStorage(cacheKey: string, gridCell: Cell): void {
  const coins = Array.from(
    {
      length: Math.floor(
        luck([gridCell.i, gridCell.j, "initialValue"].toString()) * 100,
      ),
    },
    (_, serial) => createCoinIdentifier(gridCell.i, gridCell.j, serial),
  );
  cacheStorage[cacheKey] = coins;
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

function createPopup(cacheKey: string) {
  const coinsInCache = cacheStorage[cacheKey] || [];
  const popupDiv = document.createElement("div");
  popupDiv.innerHTML = `
    <div>Cache "${cacheKey}" Inventory: <span id="value">${
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
}

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
  localStorage.setItem(
    "knownGridCells",
    JSON.stringify([...knownGridCells.entries()]),
  );
  localStorage.setItem("cacheStorage", toMemento(cacheStorage));
  localStorage.setItem("playerInventory", toMemento(playerInventory));
  localStorage.setItem("playerLine", toMemento(playerLine.getLatLngs()));
}

//saveToLocalStorage and loadfromLocalStorage done with the help of CJ Moshy
//there is no way to refactor this and it has to stay this way unfortunately
function loadFromLocalStorage(): [
  Record<string, string>,
  Record<string, string[]>,
  Map<string, Cell>,
  leaflet.Polyline,
] {
  //for the player location
  loadPlayerLocation();
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

function loadPlayerLocation() {
  const storedLocation = localStorage.getItem("playerLocation");
  if (storedLocation) {
    const { lat, lng } = JSON.parse(storedLocation);
    playerMarker.setLatLng([lat, lng]);
    map.setView([lat, lng], map.getZoom());
  }
}

function saveGameState() {
  const playerPos = playerMarker.getLatLng();
  localStorage.setItem("playerLocation", JSON.stringify(playerPos));
  saveToLocalStorage();
}

// Regenerate cache function that uses save/restore mechanics
function regenerateCache() {
  clearCacheLayers();
  const playerPos = playerMarker.getLatLng();
  saveGameState();
  createCaches(playerPos.lat, playerPos.lng);
}

function main() {
  loadPlayerLocation();
  createCaches(playerMarker.getLatLng().lat, playerMarker.getLatLng().lng);
}

main();
