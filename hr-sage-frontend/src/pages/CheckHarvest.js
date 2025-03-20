import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, ImageOverlay } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";

const Legend = () => (
  <div className="space-y-4">
    {/* Sugarcane Growth Stages */}
    <div className="bg-white p-4 shadow-md rounded-lg text-gray-700">
      <h4 className="font-bold mb-2">Sugarcane Growth Stages</h4>
      <div className="flex items-center mb-1">
        <span className="w-5 h-5 bg-yellow-400 inline-block rounded-sm mr-2"></span>
        Germination (0.1 - 0.2)
      </div>
      <div className="flex items-center mb-1">
        <span className="w-5 h-5 bg-orange-400 inline-block rounded-sm mr-2"></span>
        Tillering (0.2 - 0.4)
      </div>
      <div className="flex items-center mb-1">
        <span className="w-5 h-5 bg-green-500 inline-block rounded-sm mr-2"></span>
        Grand Growth (0.5 - 0.7)
      </div>
      <div className="flex items-center">
        <span className="w-5 h-5 bg-red-500 inline-block rounded-sm mr-2"></span>
        Ripening (0.3 - 0.5)
      </div>
    </div>
    {/* Information */}
    <div className="bg-white p-4 shadow-md rounded-lg text-gray-700">
      <h4 className="font-bold mb-2">Sample Information</h4>
      <div className="flex items-center mb-1">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
        commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
        velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint
        occaecat cupidatat non proident, sunt in culpa qui officia deserunt
        mollit anim id est laborum.
      </div>
    </div>
  </div>
);

const CheckHarvest = () => {
  const [ndviUrl, setNdviUrl] = useState(null);
  const [bounds, setBounds] = useState(null);

  useEffect(() => {
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

    axios
      .get("http://127.0.0.1:5000/get-ndvi-classified", {
        responseType: "blob",
      })
      .then((response) => {
        const url = URL.createObjectURL(response.data);
        setNdviUrl(url);
      })
      .catch((error) => console.error("Error fetching NDVI:", error));
  }, []);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-1/4 bg-gray-100 p-6">
        <Legend />
      </div>

      {/* Map */}
      <div className="w-3/4">
        <MapContainer
          center={[14.0488, 121.2799]}
          zoom={10}
          style={{ height: "100vh", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {ndviUrl && bounds && (
            <ImageOverlay url={ndviUrl} bounds={bounds} opacity={1} />
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default CheckHarvest;
