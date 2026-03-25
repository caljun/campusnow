import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface FlyTarget { lat: number; lng: number; postId?: string; }

interface MapContextType {
  mapOpen: boolean;
  setMapOpen: (v: boolean) => void;
  flyTarget: FlyTarget | null;
  flyTo: (target: FlyTarget) => void;
  clearFlyTarget: () => void;
}

const MapContext = createContext<MapContextType>({
  mapOpen: false,
  setMapOpen: () => {},
  flyTarget: null,
  flyTo: () => {},
  clearFlyTarget: () => {},
});

export function MapProvider({ children }: { children: ReactNode }) {
  const [mapOpen, setMapOpen] = useState(false);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);

  const flyTo = (target: FlyTarget) => {
    setFlyTarget(target);
    setMapOpen(true);
  };

  return (
    <MapContext.Provider value={{ mapOpen, setMapOpen, flyTarget, flyTo, clearFlyTarget: () => setFlyTarget(null) }}>
      {children}
    </MapContext.Provider>
  );
}

export const useMapContext = () => useContext(MapContext);
