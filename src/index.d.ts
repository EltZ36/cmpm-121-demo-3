// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

declare global {
  interface Cell {
    i: number;
    j: number;
  }

  interface Coin {
    cell: Cell;
    serial: string;
  }

  interface Cache {
    coins: string[];
    bounds: [leaflet.LatLngTuple, leaflet.LatLngTuple];
  }

  interface ILatLng {
    lat: number;
    lng: number;
  }

  interface IMapLib {
    createMap(center: ILatLng, zoom: number, elementId: string): leaflet.Map;
    createTileLayer(
      urlTemplate: string,
      options: leaflet.TileLayerOptions,
    ): leaflet.TileLayer;
    createMarker(position: ILatLng, tooltip: string): leaflet.Marker;
    addLayer(layer: leaflet.Layer): void;
    removeLayer(layer: leaflet.Layer): void;
    getMarkerPosition(marker: leaflet.Marker): ILatLng;
    setMarkerPosition(marker: leaflet.Marker, position: ILatLng): void;
    updateMapView(lat: number, lng: number): void;
    createRectangle(
      bounds: [leaflet.LatLngTuple, leaflet.LatLngTuple],
    ): leaflet.Rectangle;
  }

  interface SavedItems {
    playerInventory: Record<string, string>;
    cacheStorage: Record<string, string[]>;
    knownGridCells: Map<string, Cell>;
    playerLine: leaflet.Polyline;
  }
}
