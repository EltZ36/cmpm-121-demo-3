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

const createLeafletAdapter = (): IMapLib => {
  return {
    createMap(center, zoom, elementId) {
      const map = leaflet.map(elementId, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: false,
        scrollWheelZoom: false,
      });

      return {
        setView(position, zoomLevel = map.getZoom()) {
          map.setView([position.lat, position.lng], zoomLevel);
        },
        getUnderlyingMap() {
          return map;
        },
        createTileLayer(urlTemplate: string, Options: object) {
          const createdtileLayer = leaflet.tileLayer(urlTemplate, Options);
          map.addLayer(createdtileLayer);
        },
        getZoom() {
          return zoom;
        },
      } as MapInstance;
    },
    createMarker(position, tooltip) {
      const marker = leaflet.marker([position.lat, position.lng]);
      marker.bindTooltip(tooltip);

      return {
        setLatLng(ILatLng: ILatLng) {
          marker.setLatLng(ILatLng);
        },
        getLatLng() {
          return marker.getLatLng();
        },
        addTo(map: MapInstance) {
          const mapObject = map.getUnderlyingMap();
          if (mapObject instanceof leaflet.Map) {
            marker.addTo(mapObject);
          }
        },
        removeFrom(map: MapInstance) {
          const mapObject = map.getUnderlyingMap();
          if (mapObject instanceof leaflet.Map) {
            mapObject.removeLayer(marker);
          }
        },
        getUnderlyingObject() {
          return marker;
        },
      } as unknown as MarkerInstance;
    },

    createCacheLayer() {
      const cacheLayer: Set<leaflet.Layer> = new Set();
      return {
        addTo(rect: LayerInstance) {
          const rectObject = rect.getUnderlyingObject();
          if (rectObject instanceof leaflet.Rectangle) {
            cacheLayer.add(rectObject);
          }
        },
        clear() {
          cacheLayer.forEach((layer) => {
            const mapObject = map.getUnderlyingMap();
            if (mapObject instanceof leaflet.Map) {
              layer.removeFrom(mapObject);
            }
          });
          cacheLayer.clear();
        },
      } as CacheInstance;
    },

    createRectangle(bounds, popupContent) {
      // Create a Leaflet rectangle
      const rectangle = leaflet.rectangle(
        [
          [bounds[0][0], bounds[0][1]],
          [bounds[1][0], bounds[1][1]],
        ],
      );

      if (popupContent) {
        rectangle.bindPopup(popupContent());
      }

      // Return a LayerInstance
      return {
        addTo(map: MapInstance) {
          const leafletMap = map.getUnderlyingMap();
          if (leafletMap instanceof leaflet.Map) {
            rectangle.addTo(leafletMap);
          }
        },
        removeFrom(map: MapInstance) {
          const leafletMap = map.getUnderlyingMap();
          if (leafletMap instanceof leaflet.Map) {
            leafletMap.removeLayer(rectangle);
          }
        },
        getUnderlyingObject() {
          return rectangle;
        },
      } as LayerInstance;
    },
    createPolyLine(position: ILatLng, lineColor: string) {
      const polyline = leaflet.polyline([position], {
        color: lineColor,
      });
      return {
        addToLayer(map: MapInstance) {
          const leafletMap = map.getUnderlyingMap();
          if (leafletMap instanceof leaflet.Map) {
            leafletMap.addLayer(polyline);
          }
        },
        addLatLng(array: [] | ILatLng) {
          polyline.addLatLng(array);
        },
        setLatLng(number: ILatLng) {
          polyline.setLatLngs([number]);
        },
        getLatLng() {
          return polyline.getLatLngs();
        },
        setStyle(lineWidth: number) {
          polyline.setStyle({ weight: lineWidth });
        },
      } as PolylineInstance;
    },
  };
};

const matLib = createLeafletAdapter();

// Create the map using the adapter
const map = matLib.createMap(
  OAKES_CLASSROOM,
  GAMEPLAY_ZOOM_LEVEL,
  "map",
);

// Populate the map with a background tile layer
map.createTileLayer(
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
);

const createPlayerManager = (
  map: MapInstance,
  startingPosition: ILatLng,
  markerTooltip: string,
): PlayerManager => {
  let inventory: Record<string, string> = {};
  const marker = matLib.createMarker(startingPosition, markerTooltip);
  let playerLine = matLib.createPolyLine(marker.getLatLng(), "red");
  playerLine.setStyle(5);
  playerLine.addToLayer(map);
  return {
    goDirection(direction: string) {
      const offset = directionOffsets[direction];
      if (offset) {
        const currentPosition = marker.getLatLng();
        const newPosition = {
          lat: currentPosition.lat + offset.lat,
          lng: currentPosition.lng + offset.lng,
        };

        marker.setLatLng(newPosition);
        map.setView(newPosition);
        player.saveState();
      }
    },
    addToInventory(item: string) {
      inventory[item] = item;
      this.saveState(); // Automatically save state after inventory update
    },
    removeFromInventory(item: string) {
      delete inventory[item];
      this.saveState(); // Automatically save state after inventory update
    },
    saveState() {
      const playerPos = player.getMarker().getLatLng();
      localStorage.setItem("playerLocation", JSON.stringify(playerPos));
      saveToLocalStorage();
    },
    getMarker() {
      return marker;
    },
    getLine() {
      return playerLine;
    },
    setLine(newLine: PolylineInstance) {
      playerLine = newLine;
    },
    setInventory(newInventory: Record<string, string>) {
      inventory = newInventory;
    },
    getInventory() {
      return inventory;
    },
  };
};

const player = createPlayerManager(map, OAKES_CLASSROOM, "That's you");
const [playerInventory, cacheStorage, knownGridCells, playerLine] =
  loadFromLocalStorage();

player.getMarker().addTo(map);
player.setLine(playerLine);
player.setInventory(playerInventory);

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
    player.goDirection(element);
    drawLine();
    regenerateCache();
  });
  app.append(movementButton);
});

const resetButton = makeButton("🚮", () => {
  resetCaches();
});
const locationButton = makeButton("🌐", () => {
  createCaches(
    player.getMarker().getLatLng().lat,
    player.getMarker().getLatLng().lng,
  );
  showLocation();
});

app.append(resetButton, locationButton);

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
  const playerCoins = Object.keys(player.getInventory());
  if (playerCoins.length > 0) {
    const coin = player.getInventory()[playerCoins[0]];
    depositCoinIntoCache(cacheKey, coin);
    updateCoinDisplay(popupSpan, cacheKey, inventoryDisplay);
    player.saveState();
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
    player.addToInventory(coin);
    updateCoinDisplay(popupSpan, cacheKey, inventoryDisplay);
    player.saveState();
  }
}

// Display the player's points
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
if (getRecordLength(player.getInventory()) == 0) {
  statusPanel.innerHTML = "No points yet...";
} else {
  statusPanel.innerHTML = `Player Inventory: ${
    Object.keys(player.getInventory()).join(", ")
  }`;
}

function drawLine() {
  player.getLine().addLatLng(player.getMarker().getLatLng());
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
  player.getLine().setLatLng([]);
  player.getMarker().setLatLng(OAKES_CLASSROOM);
  clearCacheLayers();
}

function resetUI(): void {
  statusPanel.innerHTML = "No points yet...";
}

function saveGameStateAfterReset(): void {
  localStorage.clear();
  const playerLatLng = player.getMarker().getLatLng();
  createCaches(playerLatLng.lat, playerLatLng.lng);
  player.saveState();
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
  player.getMarker().setLatLng([lat, lng]);
  player.saveState();
  map.setView(player.getMarker().getLatLng(), map.getZoom());
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

const depositCoinIntoCache = (cacheKey: string, coin: string): void => {
  if (!cacheStorage[cacheKey]) {
    cacheStorage[cacheKey] = [];
  }

  cacheStorage[cacheKey].push(coin);
  player.removeFromInventory(coin);
  player.saveState();
};

const withdrawCoinFromCache = (cacheKey: string, coin: string): void => {
  if (!cacheStorage[cacheKey]) return;

  cacheStorage[cacheKey] = cacheStorage[cacheKey].filter((storedCoin) =>
    storedCoin !== coin
  );
  player.addToInventory(coin);
  player.saveState();
};

//change this too
//const activeCacheLayers: Set<leaflet.Layer> = new Set();
const activeCacheLayers: CacheInstance = matLib.createCacheLayer();

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
  const rect = matLib.createRectangle(bounds, () => createPopup(cacheKey));
  rect.addTo(map);
  activeCacheLayers.addTo(rect);
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
  localStorage.setItem("playerInventory", toMemento(player.getInventory()));
  localStorage.setItem("playerLine", toMemento(player.getLine().getLatLng()));
}

//saveToLocalStorage and loadfromLocalStorage done with the help of CJ Moshy
//there is no way to refactor this and it has to stay this way unfortunately
function loadFromLocalStorage(): [
  Record<string, string>,
  Record<string, string[]>,
  Map<string, Cell>,
  PolylineInstance,
] {
  //for the player location
  loadPlayerLocation();
  let knownGridCells: Map<string, Cell> = new Map();
  // Use a record to store coins
  let playerInventory: Record<string, string> = {};
  // Cache storage, using a Record structure
  let cacheStorage: Record<string, string[]> = {};
  const player = createPlayerManager(map, OAKES_CLASSROOM, "That's you");
  const playerLine = player.getLine();
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
    playerLine.setLatLng(fromMemento(_playerLine));
  }
  return [playerInventory, cacheStorage, knownGridCells, playerLine];
}

function loadPlayerLocation() {
  const storedLocation = localStorage.getItem("playerLocation");
  if (storedLocation) {
    const { lat, lng } = JSON.parse(storedLocation);
    player.getMarker().setLatLng([lat, lng]);
    map.setView(player.getMarker().getLatLng(), map.getZoom());
  }
}

// Regenerate cache function that uses save/restore mechanics
function regenerateCache() {
  clearCacheLayers();
  const playerPos = player.getMarker().getLatLng();
  player.saveState();
  createCaches(playerPos.lat, playerPos.lng);
}

function main() {
  loadPlayerLocation();
  createCaches(
    player.getMarker().getLatLng().lat,
    player.getMarker().getLatLng().lng,
  );
}

main();
