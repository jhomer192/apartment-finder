declare global {
  interface Window {
    google: {
      maps: {
        DistanceMatrixService: new () => {
          getDistanceMatrix(
            request: {
              origins: google.maps.LatLng[];
              destinations: google.maps.LatLng[];
              travelMode: google.maps.TravelMode;
            },
            callback: (
              response: google.maps.DistanceMatrixResponse | null,
              status: string,
            ) => void,
          ): void;
        };
        LatLng: new (lat: number, lng: number) => google.maps.LatLng;
        TravelMode: {
          DRIVING: google.maps.TravelMode;
        };
      };
    };
  }
}

declare namespace google.maps {
  interface LatLng {
    lat(): number;
    lng(): number;
  }

  interface DistanceMatrixResponse {
    rows: Array<{
      elements: Array<{
        status: string;
        distance: { value: number; text: string };
        duration: { value: number; text: string };
      }>;
    }>;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TravelMode {}
}

export {};
