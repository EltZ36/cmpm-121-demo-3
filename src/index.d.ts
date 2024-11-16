// @deno-types="npm:@types/leaflet@^1.9.14"
import * as leaflet from "leaflet";

interface Cell {
  i: number;
  j: number;
}

interface Coin {
  cell: Cell;
  serial: string;
}

interface Cache {
  Coins: Array<Coin>;
}

// Interfaces for Map Operations
interface IMapLib {
  createMap(
    center: { lat: number; lng: number },
    zoom: number,
    elementId: string,
  ): leaflet.Map;
  createTileLayer(
    urlTemplate: string,
    options: leaflet.TileLayerOptions,
  ): leaflet.TileLayer;
  createMarker(
    position: { lat: number; lng: number },
    tooltip: string,
  ): leaflet.Marker;
  removeLayer(layer: leaflet.Layer): void;
  addLayer(layer: leaflet.Layer): void;
  createRectangle(
    bounds: [leaflet.LatLngTuple, leaflet.LatLngTuple],
  ): leaflet.Rectangle; // Correct expected type
}

export { IMapLib };
