import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import * as d3 from "d3";
import { hexbin as d3Hexbin } from "d3-hexbin";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faSpinner } from "@fortawesome/free-solid-svg-icons";
import "leaflet/dist/leaflet.css";
import axios from "axios";

// Color for each stage
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

// Sidebar Legend
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
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => onToggleStage(stage.name)}
              >
                <td className="flex items-center space-x-2 py-2">
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
          This map visualizes sugarcane growth stages via NDVI/EVI hex‑bins.
          <br />
          Hover over a hexagon to see its stage, harvest readiness, and number
          of detected points.
        </p>
      </div>
    </div>
  );
};

// Initial map bounds (Philippines)
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

// Hexbin drawing with error tolerance
const HexbinLayer = ({ data = [], selectedStages }) => {
  const map = useMap();
  const svgRef = useRef(null);

  const drawHexbins = () => {
    try {
      if (!map) return;

      const pane = map.getPanes().overlayPane;
      d3.select(pane).selectAll("svg").remove();

      const svg = d3
        .select(pane)
        .append("svg")
        .attr("class", "leaflet-hexbin-svg");
      svgRef.current = svg;

      const g = svg.append("g").attr("class", "leaflet-zoom-hide");

      const bounds = map.getBounds();
      const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());
      const botRight = map.latLngToLayerPoint(bounds.getSouthEast());

      svg
        .attr("width", botRight.x - topLeft.x)
        .attr("height", botRight.y - topLeft.y)
        .style("left", `${topLeft.x}px`)
        .style("top", `${topLeft.y}px`);

      g.attr("transform", `translate(${-topLeft.x},${-topLeft.y})`);

      // Filter and project valid points
      const filtered = data.filter((d) => {
        return (
          d &&
          typeof d.lat === "number" &&
          typeof d.lng === "number" &&
          !isNaN(d.lat) &&
          !isNaN(d.lng) &&
          d.stage &&
          selectedStages[d.stage]
        );
      });

      const points = filtered.map((d) => {
        const pt = map.latLngToLayerPoint([d.lat, d.lng]);
        return [pt.x, pt.y, d.stage, d.lat, d.lng];
      });

      const hexbin = d3Hexbin()
        .radius(12)
        .x((d) => d[0])
        .y((d) => d[1]);
      const bins = hexbin(points);

      g.selectAll(".hexagon")
        .data(bins)
        .enter()
        .append("path")
        .attr("class", "hexagon")
        .attr("d", hexbin.hexagon())
        .attr("transform", (d) => `translate(${d.x},${d.y})`)
        .attr("fill", (d) => getColor(d[0][2]))
        .attr("fill-opacity", 0.55)
        .attr("stroke", "#333")
        .attr("stroke-width", 0.6)
        .on("mouseover", (event, d) => {
          const stage = d[0][2];
          const lat = d[0][3];
          const lng = d[0][4];
          const count = d.length;
          const html = `
            <div style="text-align:center; padding:4px;">
              <div style="font-weight:bold; color:${getColor(
                stage
              )}">${stage}</div>
              <div style="font-size:14px;">${
                stage === "Ripening" ? "✔️ Ready for Harvest" : "⏳ Not Ready"
              }</div>
              <div style="font-size:12px; color:#555;">${count} points detected</div>
            </div>`;
          L.popup({ offset: L.point(0, -10) })
            .setLatLng([lat, lng])
            .setContent(html)
            .openOn(map);
        })
        .on("mouseout", () => {
          map.closePopup();
        });
    } catch (error) {
      console.error("Error in drawing hexbins:", error);
    }
  };

  useEffect(() => {
    drawHexbins();
    map.on("moveend zoomend", drawHexbins);
    return () => {
      map.off("moveend zoomend", drawHexbins);
    };
  }, [map, data, selectedStages]);

  return null;
};

// Main component
const CheckHarvest = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState("Initializing map...");
  const [selectedStages, setSelectedStages] = useState({
    Germination: true,
    Tillering: true,
    "Grand Growth": true,
    Ripening: true,
  });
  const [fetchingData, setFetchingData] = useState(false); // Flag to prevent re-fetching
  const mapRef = useRef();

  const loadingTips = [
    "💡 Tip: Hover over hexagons to see details.",
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

  useEffect(() => {
    if (fetchingData) return; // Prevent re-executing if already fetching

    const fetchLocations = () => {
      setFetchingData(true); // Set flag to prevent re-fetching

      axios
        .get("http://127.0.0.1:5000/sugarcane-locations")
        .then((res) => {
          const points = Array.isArray(res.data.points) ? res.data.points : [];
          if (points.length > 0) {
            setLocations(points);
            setLoading(false); // Set loading to false when data is fetched
          }
        })
        .catch((err) => {
          console.error("Error fetching data:", err);
        })
        .finally(() => {
          setFetchingData(false); // Reset the fetching flag after fetching
        });
    };

    fetchLocations(); // Initial fetch
    const intervalId = setInterval(fetchLocations, 5000); // Polling every 5 seconds

    // Cleanup the polling interval when the component unmounts
    return () => clearInterval(intervalId);
  }, [fetchingData]); // Only trigger effect if not already fetching

  return (
    <div className="w-full h-screen flex flex-row bg-gray-100">
      <div className="w-full md:w-1/4 p-4 overflow-auto">
        <Legend
          onSearch={(term) => console.log("Search term:", term)}
          selectedStages={selectedStages}
          onToggleStage={(stage) =>
            setSelectedStages((prev) => ({
              ...prev,
              [stage]: !prev[stage],
            }))
          }
        />
      </div>

      <div className="w-full md:w-3/4">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-white">
            <div>
              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              <p>{loadingMsg}</p>
            </div>
          </div>
        ) : (
          <MapContainer
            ref={mapRef}
            className="w-full h-full"
            center={[10.3, 122.9]}
            zoom={7}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <MapBoundsAdjuster />
            <HexbinLayer data={locations} selectedStages={selectedStages} />
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default CheckHarvest;
