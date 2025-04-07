import React from "react";

const AboutUs = () => {
  return (
    <div className="p-20 space-x-40 justify-center flex flex-row min-h-screen bg-gradient-to-b from-green-50 to-green-200">
      <div className="align-middle py-20">
        {/* Logo */}
        <img
          src="/logotext.png"
          alt="HR-SAGE Logo"
          className="w-124 h-124 mb-6 py-0"
        />
      </div>
      <div className="flex flex-col items-center">
        {/* Title */}
        <h1 className="text-4xl font-bold text-green-700">About HR-SAGE</h1>

        {/* Description */}
        <div className="mt-6 text-lg text-center text-gray-700 max-w-lg">
          <p>
            HR-SAGE (Harvest Readiness-Sugarcane Assessment via GIS and Earth
            Observation) is a web-based application designed to assist farmers
            in determining the optimal time for harvesting sugarcane. Using
            satellite imagery and advanced data analysis techniques, the app
            provides real-time insights on sugarcane growth stages, helping
            optimize harvest time for better yield and quality.
          </p>

          <h2 className="mt-8 text-2xl font-semibold text-green-700">
            Who Developed HR-SAGE?
          </h2>
          <p className="mt-4">
            HR-SAGE was developed by Ernest Henley L. Tabilas and Concepcion L.
            Khan from the University of the Philippines Los Baños. The goal is
            to enhance agricultural practices and improve productivity for
            farmers across the country, utilizing technology to drive better
            decision-making and resource management.
          </p>

          <h2 className="mt-8 text-2xl font-semibold text-green-700">
            Contact Information
          </h2>
          <p className="mt-4 text-lg">
            For inquiries, feedback, or collaborations, feel free to reach us
            at:
          </p>
          <p className="mt-4 font-medium text-lg text-green-700">
            eltabilas@uplb.edu.ph
          </p>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>
              &copy; 2025 University of the Philippines Los Baños. All rights
              reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;
