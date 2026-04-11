# Water Tank Monitoring System - Tamil Nadu

A modern, full-stack application for monitoring and visualizing water tank quality and distribution across Tamil Nadu districts. The system provides real-time data visualization, predictive quality metrics using machine learning, and comprehensive management tools for officials.

## 🚀 Features

- **Interactive Map**: Visualize water tanks across Tamil Nadu using Leaflet-based maps.
- **Real-time Monitoring**: Track water quality parameters and refill levels.
- **Predictive Analytics**: Integrated ONNX machine learning model for quality assessment.
- **Official Dashboard**: Secure access for officials to manage tank data and view trends.
- **Responsive Design**: Built with React and Tailwind CSS for a premium mobile and desktop experience.
- **Dynamic Visualizations**: Insightful charts and graphs powered by Recharts.

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 19
- **Styling**: Tailwind CSS, Framer Motion (Animations)
- **Maps**: React Leaflet
- **Charts**: Recharts
- **Icons**: Lucide React

### Backend
- **Server**: Node.js with Express.js
- **Database**: SQLite3
- **ML Inference**: ONNX Runtime (onnxruntime-node)
- **Security**: JWT & Bcrypt.js

## 📂 Project Structure

```text
├── backend/                # Express.js server and database
│   ├── models/             # ML models (ONNX)
│   ├── server.js           # Main entry point
│   └── *.js                # Data seeding and utility scripts
├── frontend/               # React application
│   ├── src/                # Components and application logic
│   └── public/             # Static assets
└── data/                   # Raw data files (CSV)
```

## 🚥 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/chitteshdharshan/Water-Tank-monitoring-System-.git
   cd Water-Tank-monitoring-System-
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   # Start the server
   node server.js
   ```

3. **Setup Frontend**
   ```bash
   cd ../frontend
   npm install
   # Run in development mode
   npm start
   ```

## 📄 License
This project is licensed under the ISC License.
