declare module "d3-geo" {
  export interface GeoProjection {
    scale(k: number): this;
    translate(point: [number, number]): this;
    (point: [number, number]): [number, number] | null;
  }
  export function geoAlbersUsa(): GeoProjection;
}
