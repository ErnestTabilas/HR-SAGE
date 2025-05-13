import React from "react";
import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css";

const sugarcaneImages = [
  "https://www.aljazeera.com/wp-content/uploads/2017/03/cc308c2bca914ad08a7e751598b21aaa_6.jpeg",
  "https://media.assettype.com/newindianexpress%2F2025-03-16%2F0sdd056o%2F1-53-1-agribudgetsugarcane11503try4.jpg?rect=63%2C0%2C2180%2C1226",
  "https://archive.wwf.org.ph/wp-content/uploads/2019/11/Climate-and-Sugarcane-PR-1.jpg",
  "https://sourceasia.thesourcemediaassets.com/2024/12/0835-hero-op2-scaled.jpg",
];

const Home = () => {
  return (
    <div className="relative h-screen w-full overflow-hidden overlay-gradient">
      {/* BACKGROUND CAROUSEL */}
      <Carousel
        autoPlay
        infiniteLoop
        showThumbs={false}
        showStatus={false}
        swipeable={false}
        interval={6000}
        animationHandler="fade"
        className="absolute top-0 left-0 w-full h-full z-0"
      >
        {sugarcaneImages.map((src, index) => (
          <div key={index}>
            <img
              src={src}
              alt={`Slide ${index + 1}`}
              className="h-screen w-full object-cover"
            />
          </div>
        ))}
      </Carousel>

      {/* GRADIENT OVERLAY */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/90 to-black/20 z-10" />

      {/* FOREGROUND CONTENT */}
      <div className="flex flex-row items-center justify-between h-full w-full">
        <div className="relative z-20 flex flex-col items-start justify-center h-full pl-20 px-12 text-white">
          <img
            src="/logo.png"
            alt="HR-SAGE Logo"
            className="w-50 my-4 mx-4 mr-20 filter drop-shadow-[0_0_8px_rgba(255,255,255,255.8)] animate-pulse"
          />
          <h1 className="text-4xl font-bold mb-4 drop-shadow-lg">
            Welcome to HR-SAGE
          </h1>
          <p className="text-lg font-light drop-shadow">
            Harvest-Ready Sugarcane Assessment via GIS and Earth Observation
          </p>
        </div>
        <div className="relative z-20 flex flex-col items-end justify-center h-full pl-20 px-12 text-white w-1/3 text-end">
          <h1 className="text-2xl font-bold mb-4 drop-shadow-lg">
            What is HR-SAGE?
          </h1>
          <p className="text-sm font-light drop-shadow">
            Our web app, HR‑SAGE (Harvest‑Ready Sugarcane Assessment via GIS and
            Earth Observation), helps sugarcane farmers and agronomists know
            exactly when fields are ready for harvest. It combines satellite
            imagery (Sentinel‑2) and high‑resolution GEDI‑Sentinel maps to
            compute vegetation indices (NDVI) and growth‑stage labels across
            your region. Simply navigate to “Check Harvest” to explore an
            interactive map of sugarcane growth stages, click any field pixel
            for its current NDVI, and download printable reports or PDF
            snapshots of the map with legends and timestamps. Continuous data
            updates every five days ensure you always have the latest insights
            for optimal harvest timing.
          </p>
          <a
            href="/check-harvest"
            className="mt-4 px-6 py-2 text-lg font-semibold text-white rounded-lg transition font-thin bg-emerald-700 hover:bg-emerald-800"
          >
            Go to Check Harvest Page
          </a>
        </div>
      </div>
    </div>
  );
};

export default Home;
