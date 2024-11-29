interface Cell {
  i: number;
  j: number;
}

interface Coin {
  cell: Cell;
  serial: string;
}

interface ILatLng {
  lat: number;
  lng: number;
}

type ILatLngTuple = [number, number];

interface IMapLib {
  createMap(center: ILatLng, zoom: number, elementId: string): MapInstance;
  createMarker(position: ILatLng, tooltip: string): MarkerInstance;
  createRectangle(
    bounds: [ILatLngTuple, ILatLngTuple],
    popupContent?: () => HTMLElement,
  ): LayerInstance;
  createCacheLayer(): CacheInstance;
  createPolyLine(position: ILatLng, lineColor: string): PolylineInstance;
}

interface sharedInstance {
  getLatLng(): ILatLng;
  setLatLng(newLatLng: ILatLng): void;
}

interface MarkerInstance extends LayerInstance {
  setLatLng(newLatLng: ILatLng): void;
  setLatLng([lat, lng]: ILatLngTuple): void;
}

interface LayerInstance extends sharedInstance {
  addTo(map: MapInstance): void;
  removeFrom(map: MapInstance): void;
  getUnderlyingObject(): object;
}

interface CacheInstance {
  addTo(rect: LayerInstance): void;
  clear(): void;
}

interface MapInstance {
  setView(position: ILatLng, zoom?: number): void;
  getUnderlyingMap(): object;
  createTileLayer(urlTemplate: string, Options: object): void;
  getZoom(): number;
}

interface PolylineInstance {
  addToLayer(map: MapInstance): void;
  addLatLng(array: [] | ILatLng): void;
  setLatLng(number: ILatLng | []): void;
  getLatLng(): ILatLng[];
  setStyle(linewidth: number): void;
}

interface GameMap {
  initialize(): void;
  resetGame(): void;
  updatePlayerMarker(direction: string): void;
  getplayerMarker(): MarkerInstance;
  addCache(cell: Cell): void;
  generateCacheNeighborhood(center: Cell): void;
  loadFromLocalStorage(): void;
}

interface SavedItems {
  playerInventory: Record<string, string>;
  cacheStorage: Record<string, string[]>;
  knownGridCells: Map<string, Cell>;
  playerLine: PolylineInstance;
}

interface PlayerManager {
  goDirection(direction: string): void; // Moves the player in the specified direction
  addToInventory(item: string): void; // Add an item to player's inventory
  removeFromInventory(item: string): void; // Remove an item from inventory
  saveState(): void; // Save the player's state to localStorage
  getMarker(): MarkerInstance;
  getLine(): PolylineInstance;
  setLine(line: PolylineInstance): void;
  setInventory(inventory: Record<string, string>): void;
  getInventory(): Record<string, string>;
}
