import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faBars, faTimes } from "@fortawesome/free-solid-svg-icons";
import Home from "./pages/Home";
import CheckHarvest from "./pages/CheckHarvest";

const App = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <Router>
      <div className="relative">
        <div className="bg-emerald-600 shadow-md flex flex-row py-0 px-6 justify-between">
          <div className="flex items-center">
            <FontAwesomeIcon
              icon={faBars}
              className="text-white text-2xl cursor-pointer mr-4"
              onClick={toggleMenu}
            />
            {/* Logo */}
            <img
              src="/logo.png"
              alt="HR-SAGE Logo"
              className="w-16 h-14 my-4 mx-4"
            />
          </div>
          <nav className="flex items-center space-x-10 py-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                className="px-4 py-2 rounded-lg text-black"
              />
              <FontAwesomeIcon
                icon={faSearch}
                className="absolute right-3 top-3 text-black"
              />
            </div>
            <Link
              to="/"
              className="px-6 py-2 text-lg font-semibold text-white hover:bg-green-500 rounded-lg transition font-thin"
            >
              Home
            </Link>
            <Link
              to="/check-harvest"
              className="px-6 py-2 text-lg font-semibold text-white hover:bg-green-500 rounded-lg transition font-thin"
            >
              Check Harvest
            </Link>
          </nav>
        </div>

        {/* Overlay */}
        {menuOpen && (
          <div
            className="fixed inset-0 bg-black opacity-50 z-10"
            onClick={toggleMenu}
          ></div>
        )}

        {/* Sliding Menu */}
        <div
          className={`fixed top-0 left-0 h-full bg-emerald-600 shadow-md transform ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          } transition-transform duration-300 ease-in-out z-20`}
          style={{ width: "250px" }}
        >
          <div className="flex justify-between p-4">
            <h1 className="px-4 text-4xl font-light text-white">MENU</h1>
            <div className="flex justify-center items-center">
              <FontAwesomeIcon
                icon={faTimes}
                className="text-white font-thin text-2xl cursor-pointer px-2 hover:bg-red-500 rounded-lg transition font-thin px-4 py-2"
                onClick={toggleMenu}
              />
            </div>
          </div>
          <nav className="flex flex-col space-y-4 p-4">
            <Link
              to="/"
              className="text-lg font-semibold text-white hover:bg-green-500 rounded-lg transition font-thin px-4 py-2"
              onClick={toggleMenu}
            >
              Home
            </Link>
            <Link
              to="/check-harvest"
              className="text-lg font-semibold text-white hover:bg-green-500 rounded-lg transition font-thin px-4 py-2"
              onClick={toggleMenu}
            >
              Check Harvest
            </Link>
          </nav>
        </div>

        <div className="p-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/check-harvest" element={<CheckHarvest />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
