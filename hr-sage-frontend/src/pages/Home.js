import React from "react";

const Home = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-green-50 to-green-200">
      {/* Logo */}
      <img
        src="/logotext.png"
        alt="HR-SAGE Logo"
        className="w-124 h-124 mb-4 py-0"
      />

      {/* Welcome Text */}
      <h1 className="text-4xl font-bold text-green-700">Welcome!</h1>
      <p className="mt-4 text-gray-700 text-lg max-w-lg text-center">
        The HR-SAGE system provides real-time analysis of sugarcane fields,
        helping farmers determine the best time to harvest. Click "Check
        Harvest" to view field data.
      </p>
    </div>
  );
};

export default Home;
