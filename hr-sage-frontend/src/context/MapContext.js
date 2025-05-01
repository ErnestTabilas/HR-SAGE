import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";

// Create context
const MapContext = createContext(null);

/**
 * MapProvider wraps the app and keeps sugarcane points in memory.
 * It fetches data only once and exposes loading/error states.
 */
export const MapProvider = ({ children }) => {
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch points from backend
  const fetchPoints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get("http://127.0.0.1:5000/sugarcane-locations");
      const pts = Array.isArray(res.data.points) ? res.data.points : [];
      setPoints(pts);
    } catch (err) {
      console.error("Error loading sugarcane data:", err);
      setError("Failed to load sugarcane data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount, fetch if not already fetched
  useEffect(() => {
    if (points === null) {
      fetchPoints();
    }
  }, [points, fetchPoints]);

  return (
    <MapContext.Provider value={{ points, loading, error, fetchPoints }}>
      {children}
    </MapContext.Provider>
  );
};

/**
 * Custom hook to use map context
 */
export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error("useMapContext must be used within a MapProvider");
  }
  return context;
};
