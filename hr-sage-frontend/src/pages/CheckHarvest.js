import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import * as d3 from "d3";
import { hexbin as d3Hexbin } from "d3-hexbin";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faSpinner } from "@fortawesome/free-solid-svg-icons";
import "leaflet/dist/leaflet.css";
import axios from "axios";

// Map NDVI stage to color
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

const getTextForPopup = (stage) => {
  const harvestReady =
    stage === "Ripening" ? "✔️ Ready for Harvest" : "⏳ Not Ready";
  return `<div style="text-align:center;">
    <strong style="color:${getColor(stage)};">${stage}</strong><br/>
    ${harvestReady}
  </div>`;
};

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
            className="border-2 rounded-l-md w-full p-2"
          />
          <button
            onClick={() => searchTerm && onSearch(searchTerm)}
            className="bg-emerald-600 px-3 py-2 rounded-r-md hover:bg-emerald-700"
          >
            <FontAwesomeIcon icon={faSearch} className="text-white py-1" />
          </button>
        </div>
      </div>

      <div className="bg-white p-5 shadow-md rounded-lg text-gray-700">
        <h4 className="font-bold text-lg mb-3 text-green-700">
          Sugarcane Growth Stages
        </h4>
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left pb-2">Stage</th>
              <th className="text-right pb-2">NDVI Value</th>
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

      <div className="bg-white p-5 shadow-md rounded-lg text-gray-700">
        <h4 className="font-bold text-lg mb-3 text-green-700">
          About this Map
        </h4>
        <p className="text-sm text-gray-600 leading-relaxed">
          This map visualizes sugarcane farm growth stages using NDVI. Hex bins
          group nearby data to improve performance and readability. Click on a
          hexagon to view its growth stage and harvest readiness.
        </p>
      </div>
    </div>
  );
};

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

const HexbinLayer = ({ data, selectedStages }) => {
  const map = useMap();
  const popupRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    const container = d3.select(map.getPanes().overlayPane);
    container.selectAll("svg").remove();

    const svg = container.append("svg");
    const g = svg.append("g").attr("class", "leaflet-zoom-hide");

    const width = map.getSize().x;
    const height = map.getSize().y;
    svg.attr("width", width).attr("height", height);

    const hexRadius = 12;
    const hexbin = d3Hexbin()
      .radius(hexRadius)
      .x((d) => d[0])
      .y((d) => d[1]);

    const filtered = data.filter((d) => selectedStages[d.stage]);
    const hexPoints = filtered.map((d) => {
      const point = map.latLngToLayerPoint([d.lat, d.lng]);
      return [point.x, point.y, d.stage, d.lat, d.lng];
    });

    const bins = hexbin(hexPoints);

    g.selectAll(".hexagon")
      .data(bins)
      .enter()
      .append("path")
      .attr("d", () => hexbin.hexagon())
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .attr("fill", (d) => getColor(d[0][2]))
      .attr("fill-opacity", 0.5)
      .attr("stroke", "#222")
      .attr("stroke-width", 0.5)
      .on("click", function (event, d) {
        const stage = d[0][2];
        const lat = d[0][3];
        const lng = d[0][4];
        const popup = L.popup()
          .setLatLng([lat, lng])
          .setContent(getTextForPopup(stage))
          .openOn(map);
        popupRef.current = popup;
      });

    const redraw = () => {
      container.selectAll("svg").remove();
      draw();
    };

    const draw = () => {
      svg.attr("width", map.getSize().x).attr("height", map.getSize().y);
    };

    map.on("zoomend moveend", redraw);
    return () => map.off("zoomend moveend", redraw);
  }, [map, data, selectedStages]);

  return null;
};

const CheckHarvest = () => {
  const [sugarcaneLocations, setSugarcaneLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing map...");
  const loadingMessages = [
    "💡 Tip: Click on hexagons to see sugarcane growth stage.",
    "🧭 Tip: Use the search bar to zoom to a location.",
    "🌱 Germination (NDVI 0.1 - 0.2): Very early stage of sugarcane growth.",
    "🌾 Ripening (NDVI 0.3 - 0.5): Sugarcane may be ready for harvest.",
    "🔍 Tip: Toggle stages in the legend to reduce clutter on the map.",
    "🗺️ Map loads regional data from satellite imagery, updated every 5 days.",
  ];
  const [selectedStages, setSelectedStages] = useState({
    Germination: true,
    Tillering: true,
    "Grand Growth": true,
    Ripening: true,
  });
  const mapRef = useRef(null);
  const philippinesBounds = [
    [4.5, 116.5],
    [21.5, 126.5],
  ];

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % loadingMessages.length;
      setLoadingMessage(loadingMessages[i]);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    axios
      .get("http://127.0.0.1:5000/sugarcane-locations")
      .then((res) => {
        setSugarcaneLocations(res.data);
        setLoading(false);
      })
      .catch((err) => console.error("Error loading data:", err));
  }, []);

  const searchLocation = async (query) => {
    try {
      const res = await axios.get(
        `https://nominatim.openstreetmap.org/search`,
        {
          params: { q: query, format: "json", countrycodes: "PH", limit: 1 },
        }
      );
      if (res.data.length > 0) {
        const { lat, lon } = res.data[0];
        mapRef.current.setView([parseFloat(lat), parseFloat(lon)], 15);
      } else alert("Location not found.");
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  const toggleStage = (stage) =>
    setSelectedStages((prev) => ({ ...prev, [stage]: !prev[stage] }));

  return (
    <div className="flex h-screen">
      <div className="bg-green-50 w-1/4 p-6 overflow-y-auto border-r">
        <Legend
          onSearch={searchLocation}
          selectedStages={selectedStages}
          onToggleStage={toggleStage}
        />
      </div>
      <div className="w-3/4 relative z-0">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-70 z-10">
            <FontAwesomeIcon
              icon={faSpinner}
              spin
              className="text-emerald-600 text-4xl mb-3"
            />
            <p className="text-lg font-medium text-gray-600 text-center p-6">
              {loadingMessage}
            </p>
          </div>
        ) : (
          <MapContainer
            ref={mapRef}
            style={{ height: "100vh", width: "100%" }}
            bounds={philippinesBounds}
            maxBounds={philippinesBounds}
            zoom={7}
            minZoom={6}
            maxZoom={24}
            scrollWheelZoom={true}
            maxBoundsViscosity={1.0}
          >
            <MapBoundsAdjuster />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <HexbinLayer
              data={sugarcaneLocations}
              selectedStages={selectedStages}
            />
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default CheckHarvest;
