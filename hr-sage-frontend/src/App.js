import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, ImageOverlay } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";

const Legend = () => (
  <div
    style={{
      position: "absolute",
      bottom: "20px",
      left: "20px",
      background: "white",
      padding: "10px",
      borderRadius: "5px",
    }}
  >
    <h4>Sugarcane Growth Stages</h4>
    <div>
      <span
        style={{
          background: "yellow",
          width: "20px",
          height: "20px",
          display: "inline-block",
        }}
      ></span>{" "}
      Germination (0.1 - 0.2)
    </div>
    <div>
      <span
        style={{
          background: "orange",
          width: "20px",
          height: "20px",
          display: "inline-block",
        }}
      ></span>{" "}
      Tillering (0.2 - 0.4)
    </div>
    <div>
      <span
        style={{
          background: "green",
          width: "20px",
          height: "20px",
          display: "inline-block",
        }}
      ></span>{" "}
      Grand Growth (0.5 - 0.7)
    </div>
    <div>
      <span
        style={{
          background: "red",
          width: "20px",
          height: "20px",
          display: "inline-block",
        }}
      ></span>{" "}
      Ripening (0.3 - 0.5)
    </div>
  </div>
);

const App = () => {
  const [ndviUrl, setNdviUrl] = useState(null);
  const [bounds, setBounds] = useState(null);

  useEffect(() => {
    // Fetch bounding box
    axios
      .get("http://127.0.0.1:5000/get-ndvi-info")
      .then((response) => {
        const { southwest, northeast } = response.data;
        setBounds([
          [southwest[0], southwest[1]],
          [northeast[0], northeast[1]],
        ]); // Leaflet format
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
      .catch((error) => console.error("Error fetching NDVI:", error));
  }, []);

  return (
    <MapContainer
      center={[14.0488, 121.2799]}
      zoom={10}
      style={{ height: "100vh", width: "100vw" }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {ndviUrl && bounds && (
        <ImageOverlay url={ndviUrl} bounds={bounds} opacity={1} />
      )}
      <Legend />
    </MapContainer>
  );
};

export default App;
