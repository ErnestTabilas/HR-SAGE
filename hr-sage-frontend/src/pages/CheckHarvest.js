import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  CircleMarker,
  Popup,
} from "react-leaflet";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faSpinner } from "@fortawesome/free-solid-svg-icons";
import "leaflet/dist/leaflet.css";
import axios from "axios";

// Map stage → color
const getColor = (stage) => {
  switch (stage) {
    case "Germination":
      return "#ef4444";
    case "Tillering":
      return "#f97316";
    case "Grand Growth":
      return "#eab308";
    case "Ripening":
      return "#22c55e";
    default:
      return "#9ca3af";
  }
};

// Legend component
const Legend = ({ onSearch, selectedStages, onToggleStage }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const stageInfo = [
    { name: "Germination", color: "bg-red-500", range: "(0.1 - 0.2)" },
    { name: "Tillering", color: "bg-orange-500", range: "(0.2 - 0.4)" },
    { name: "Grand Growth", color: "bg-yellow-500", range: "(0.5 - 0.7)" },
    { name: "Ripening", color: "bg-green-500", range: "(0.3 - 0.5)" },
  ];

  return (
    <div className="space-y-4 px-4">
      {/* Search */}
      <div className="bg-white p-5 shadow-md rounded-lg">
        <h4 className="font-bold text-lg mb-3 text-green-700">
          Search for a Place
        </h4>
        <div className="flex items-center">
          <input
            type="text"
            className="border-2 rounded-l-md w-full p-2"
            placeholder="Enter a place name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            className="bg-emerald-600 px-3 py-2 rounded-r-md hover:bg-emerald-700"
            onClick={() => searchTerm && onSearch(searchTerm)}
          >
            <FontAwesomeIcon icon={faSearch} className="text-white" />
          </button>
        </div>
      </div>

      {/* Growth Stages */}
      <div className="bg-white p-5 shadow-md rounded-lg text-gray-700">
        <h4 className="font-bold text-lg mb-3 text-green-700">
          Sugarcane Growth Stages
        </h4>
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left pb-2">Stage</th>
              <th className="text-right pb-2">NDVI</th>
            </tr>
          </thead>
          <tbody>
            {stageInfo.map((stage) => (
              <tr
                key={stage.name}
                className="cursor-pointer"
                onClick={() => onToggleStage(stage.name)}
              >
                <td className="flex items-center space-x-2">
                  <span
                    className={`rounded-full w-5 h-5 ${
                      selectedStages[stage.name] ? stage.color : "bg-gray-300"
                    }`}
                  ></span>
                  <span>{stage.name}</span>
                </td>
                <td className="text-right text-xs">{stage.range}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* About */}
      <div className="bg-white p-5 shadow-md rounded-lg text-gray-700">
        <h4 className="font-bold text-lg mb-3 text-green-700">
          About this Map
        </h4>
        <p className="text-sm text-gray-600 leading-relaxed">
          This map visualizes sugarcane growth stages via NDVI/EVI markers.
          <br />
          Hover over a marker to see its stage and readiness.
        </p>
      </div>
    </div>
  );
};

// Force initial fit to PH bounds
const MapBoundsAdjuster = () => {
  const map = useMap();
  useEffect(() => {
    map.fitBounds([
      [4.5, 116.5],
      [21.5, 126.5],
    ]);
  }, [map]);
  return null;
};

const CheckHarvest = () => {
  const [locations, setLocations] = useState([]); // Array of points
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState("Initializing map...");
  const [selectedStages, setSelectedStages] = useState({
    Germination: true,
    Tillering: true,
    "Grand Growth": true,
    Ripening: true,
  });
  const mapRef = useRef();

  const loadingTips = [
    "💡 Tip: Hover on markers to see details.",
    "🧭 Tip: Use the search bar to zoom.",
    "🔍 Tip: Toggle stages in the legend.",
    "🌱 Germination (NDVI 0.1–0.2): Early growth.",
    "🌾 Ripening (NDVI 0.3–0.5): Ready for harvest soon.",
    "🗓️ Data updates every 5 days.",
  ];
  useEffect(() => {
    let idx = 0;
    const iv = setInterval(() => {
      idx = (idx + 1) % loadingTips.length;
      setLoadingMsg(loadingTips[idx]);
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  // Fetch from backend
  useEffect(() => {
    axios
      .get("http://127.0.0.1:5000/sugarcane-locations")
      .then((res) => {
        setLocations(Array.isArray(res.data.points) ? res.data.points : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading data:", err);
        setLoading(false);
      });
  }, []);

  const searchLocation = async (q) => {
    try {
      const r = await axios.get("https://nominatim.openstreetmap.org/search", {
        params: { q, format: "json", countrycodes: "PH", limit: 1 },
      });
      if (r.data[0]) {
        const { lat, lon } = r.data[0];
        mapRef.current.setView([+lat, +lon], 15);
      } else {
        alert("Location not found.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleStage = (stage) =>
    setSelectedStages((prev) => ({ ...prev, [stage]: !prev[stage] }));

  const PH_BOUNDS = [
    [4.5, 116.5],
    [21.5, 126.5],
  ];

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="bg-green-50 w-1/4 p-6 overflow-y-auto border-r">
        <Legend
          onSearch={searchLocation}
          selectedStages={selectedStages}
          onToggleStage={toggleStage}
        />
      </div>

      {/* Map */}
      <div className="w-3/4 relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-80 z-10">
            <FontAwesomeIcon
              icon={faSpinner}
              spin
              className="text-emerald-600 text-4xl mb-3"
            />
            <p className="text-lg font-medium text-gray-600 text-center p-6">
              {loadingMsg}
            </p>
          </div>
        )}
        <MapContainer
          whenCreated={(map) => (mapRef.current = map)}
          bounds={PH_BOUNDS}
          maxBounds={PH_BOUNDS}
          zoom={7}
          minZoom={6}
          maxZoom={24}
          scrollWheelZoom
          style={{ height: "100vh", width: "100%" }}
        >
          <MapBoundsAdjuster />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Simple circle markers */}
          {locations.map((pt, i) => {
            if (!selectedStages[pt.stage]) return null;
            return (
              <CircleMarker
                key={i}
                center={[pt.lat, pt.lng]}
                radius={6}
                pathOptions={{
                  color: getColor(pt.stage),
                  fillColor: getColor(pt.stage),
                  fillOpacity: 0.6,
                  weight: 1,
                }}
              >
                <Popup>
                  <div className="text-center">
                    <strong style={{ color: getColor(pt.stage) }}>
                      {pt.stage}
                    </strong>
                    <br />
                    {pt.stage === "Ripening"
                      ? "✔️ Ready for Harvest"
                      : "⏳ Not Ready"}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
};

export default CheckHarvest;
