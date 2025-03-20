import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, ImageOverlay, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";

const Legend = () => (
  <div className="space-y-6 p-4">
    {/* Sugarcane Growth Stages */}
    <div className="bg-white p-5 shadow-md rounded-lg text-gray-700">
      <h4 className="font-bold text-lg mb-3 text-green-700">
        Sugarcane Growth Stages
      </h4>
      <div className="flex items-center mb-2">
        <span className="w-5 h-5 bg-yellow-400 inline-block rounded-sm mr-3"></span>
        <span>Germination (NDVI: 0.1 - 0.2)</span>
      </div>
      <div className="flex items-center mb-2">
        <span className="w-5 h-5 bg-orange-400 inline-block rounded-sm mr-3"></span>
        <span>Tillering (NDVI: 0.2 - 0.4)</span>
      </div>
      <div className="flex items-center mb-2">
        <span className="w-5 h-5 bg-green-500 inline-block rounded-sm mr-3"></span>
        <span>Grand Growth (NDVI: 0.5 - 0.7)</span>
      </div>
      <div className="flex items-center">
        <span className="w-5 h-5 bg-red-500 inline-block rounded-sm mr-3"></span>
        <span>Ripening (NDVI: 0.3 - 0.5)</span>
      </div>
    </div>

    {/* Information Section */}
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
      map.fitBounds(bounds, { padding: [10, 10] }); // Adjust view to fit GeoTIFF bounds
    }
  }, [bounds, map]);

  return null;
};

const CheckHarvest = () => {
  const [ndviUrl, setNdviUrl] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);

  useEffect(() => {
    setLoading(true);

    // Fetch NDVI bounding box
    axios
      .get("http://127.0.0.1:5000/get-ndvi-info")
      .then((response) => {
        const { southwest, northeast } = response.data;
        setBounds([
          [southwest[0], southwest[1]],
          [northeast[0], northeast[1]],
        ]);
      })
      .catch((error) => console.error("Error fetching NDVI metadata:", error));

    // Fetch classified NDVI (growth stages)
    axios
      .get("http://127.0.0.1:5000/get-ndvi-classified", {
        responseType: "blob",
      })
      .then((response) => {
        const url = URL.createObjectURL(response.data);
        setNdviUrl(url);
      })
      .catch((error) => console.error("Error fetching NDVI:", error))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-1/4 bg-gray-50 p-6 border-r border-gray-300 overflow-y-auto">
        <Legend />
      </div>

      {/* Map */}
      <div className="w-3/4 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70">
            <p className="text-lg font-semibold text-gray-700">
              Loading NDVI data...
            </p>
          </div>
        ) : (
          <MapContainer
            center={[14.0488, 121.2799]} // Default center, but will be overridden
            zoom={13}
            className="h-full w-full"
            ref={mapRef}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {bounds && <MapBoundsAdjuster bounds={bounds} />}
            {ndviUrl && bounds && (
              <ImageOverlay url={ndviUrl} bounds={bounds} opacity={0.7} />
            )}
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default CheckHarvest;
