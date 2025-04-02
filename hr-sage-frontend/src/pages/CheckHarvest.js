import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  ImageOverlay,
  useMap,
  CircleMarker,
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";

const Legend = () => (
  <div className="space-y-6 p-4">
    <div className="bg-white p-5 shadow-md rounded-lg text-gray-700">
      <h4 className="font-bold text-lg mb-3 text-green-700">
        Sugarcane Growth Stages
      </h4>
      <div className="flex items-center mb-2">
        <span className="rounded-full w-5 h-5 bg-red-400 inline-block rounded-sm mr-3"></span>
        <span>Germination (NDVI: 0.1 - 0.2)</span>
      </div>
      <div className="flex items-center mb-2">
        <span className="rounded-full w-5 h-5 bg-orange-400 inline-block rounded-sm mr-3"></span>
        <span>Tillering (NDVI: 0.2 - 0.4)</span>
      </div>
      <div className="flex items-center mb-2">
        <span className="rounded-full w-5 h-5 bg-yellow-500 inline-block rounded-sm mr-3"></span>
        <span>Grand Growth (NDVI: 0.5 - 0.7)</span>
      </div>
      <div className="flex items-center">
        <span className="rounded-full w-5 h-5 bg-green-500 inline-block rounded-sm mr-3"></span>
        <span>Ripening (NDVI: 0.3 - 0.5)</span>
      </div>
    </div>
    <div className="bg-white p-5 shadow-md rounded-lg text-gray-700">
      <h4 className="font-bold text-lg mb-3 text-green-700">About this Map</h4>
      <p className="text-sm text-gray-600 leading-relaxed">
        This map visualizes the sugarcane farm growth stages based on NDVI
        (Normalized Difference Vegetation Index). The colors represent different
        stages of growth, helping farmers determine the right time for
        harvesting.
      </p>
    </div>
  </div>
);

const MapBoundsAdjuster = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [10, 10] });
    }
  }, [bounds, map]);
  return null;
};

const CheckHarvest = () => {
  const [ndviUrl, setNdviUrl] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [sugarcaneLocations, setSugarcaneLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);

  useEffect(() => {
    setLoading(true);

    axios
      .get("http://127.0.0.1:5000/ndvi-data")
      .then((response) => {
        const { min_lon, min_lat, max_lon, max_lat } = response.data;
        const mapBounds = [
          [min_lat, min_lon],
          [max_lat, max_lon],
        ];
        setBounds(mapBounds);
      })
      .catch((error) => console.error("Error fetching NDVI metadata:", error));

    axios
      .get("http://127.0.0.1:5000/sugarcane-locations")
      .then((response) => {
        const locations = Array.isArray(response.data) ? response.data : [];
        setSugarcaneLocations(locations);
        setLoading(false);
      })
      .catch((error) =>
        console.error("Error fetching sugarcane locations:", error)
      );
  }, []);

  const getTextColor = (growthStage) => {
    switch (growthStage) {
      case "Germination":
        return "text-red-500";
      case "Tillering":
        return "text-orange-500";
      case "Grand Growth":
        return "text-yellow-500";
      case "Ripening":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };

  return (
    <div className="flex h-screen">
      <div className="w-1/4 bg-gray-50 p-6 border-r border-gray-300 overflow-y-auto">
        <Legend />
      </div>
      <div className="w-3/4 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70">
            <p className="text-lg font-semibold text-gray-700">
              Loading NDVI data...
            </p>
          </div>
        ) : (
          <MapContainer
            style={{ height: "100vh", width: "100%" }}
            bounds={bounds}
            ref={mapRef}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {bounds && <MapBoundsAdjuster bounds={bounds} />}
            {ndviUrl && bounds && (
              <ImageOverlay url={ndviUrl} bounds={bounds} opacity={0.7} />
            )}
            {!loading &&
              sugarcaneLocations.map((location, index) => (
                <CircleMarker
                  key={index}
                  center={[location.lat, location.lng]}
                  radius={5}
                  pathOptions={{
                    color: location.color,
                    fillColor: location.color,
                    fillOpacity: 0.5,
                  }}
                >
                  <Popup>
                    <div className="rounded-md text-center">
                      <span
                        className={`font-bold text-lg ${getTextColor(
                          location.stage
                        )}`}
                      >
                        {location.stage}
                      </span>
                      <br />
                      {location.stage === "Ripening"
                        ? "✔️ Ready for Harvest"
                        : "⏳ Not Ready"}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default CheckHarvest;
