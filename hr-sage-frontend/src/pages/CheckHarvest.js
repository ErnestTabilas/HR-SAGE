import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  ImageOverlay,
  useMap,
  CircleMarker,
  Popup,
} from "react-leaflet";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faBars,
  faTimes,
  faBell,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import "leaflet/dist/leaflet.css";
import axios from "axios";

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

const Legend = ({ onSearch }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = () => {
    if (searchTerm.trim() !== "") {
      onSearch(searchTerm);
    }
  };

  return (
    <div className="space-y-4 px-4">
      {/* Search Input */}
      <div className="bg-white p-5 shadow-md rounded-lg">
        <h4 className="font-bold text-lg mb-3 text-green-700">
          Search for a Place
        </h4>
        <div className="flex items-center ">
          <input
            type="text"
            placeholder="Enter a place name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-2 rounded-l-md w-full p-2 focus:outline-none focus:ring focus:border-emerald-500"
          />
          <button
            onClick={handleSearch}
            className="bg-emerald-600 px-3 py-2 rounded-r-md hover:bg-emerald-700"
          >
            <FontAwesomeIcon icon={faSearch} className="text-white py-1" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white p-5 shadow-md rounded-lg text-gray-700">
        <h4 className="font-bold text-lg mb-3 text-green-700">
          Sugarcane Growth Stages
        </h4>
        <div className="flex items-center mb-2">
          <span className="rounded-full w-5 h-5 bg-red-400 inline-block mr-3"></span>
          <span>Germination (NDVI: 0.1 - 0.2)</span>
        </div>
        <div className="flex items-center mb-2">
          <span className="rounded-full w-5 h-5 bg-orange-400 inline-block mr-3"></span>
          <span>Tillering (NDVI: 0.2 - 0.4)</span>
        </div>
        <div className="flex items-center mb-2">
          <span className="rounded-full w-5 h-5 bg-yellow-500 inline-block mr-3"></span>
          <span>Grand Growth (NDVI: 0.5 - 0.7)</span>
        </div>
        <div className="flex items-center">
          <span className="rounded-full w-5 h-5 bg-green-500 inline-block mr-3"></span>
          <span>Ripening (NDVI: 0.3 - 0.5)</span>
        </div>
      </div>
      <div className="bg-white p-5 shadow-md rounded-lg text-gray-700">
        <h4 className="font-bold text-lg mb-3 text-green-700">
          About this Map
        </h4>
        <p className="text-sm text-gray-600 leading-relaxed">
          This map visualizes the sugarcane farm growth stages based on NDVI.
          The colors represent different stages of growth, helping farmers
          determine the right time for harvesting.
        </p>
      </div>
    </div>
  );
};

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

  const searchLocation = async (query) => {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search`,
        {
          params: {
            q: query,
            format: "json",
            countrycodes: "PH",
            limit: 1,
          },
        }
      );

      if (response.data.length > 0) {
        const { lat, lon } = response.data[0];
        if (mapRef.current) {
          mapRef.current.setView([parseFloat(lat), parseFloat(lon)], 15);
        }
      } else {
        alert("Location not found. Try a different search.");
      }
    } catch (error) {
      console.error("Error searching location:", error);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="bg-gradient-to-b from-green-50 to-green-200 w-1/4 bg-gray-50 p-6 border-r border-gray-300 overflow-y-auto">
        <Legend onSearch={searchLocation} />
      </div>

      {/* Map Section */}
      <div className="w-3/4 relative z-0">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
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
