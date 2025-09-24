// src/App.tsx
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import WorldMap from "./components/WorldMap";
import RegionPage from "./pages/RegionPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorldMap />} />
        <Route
          path="/region/:regionId"
          element={<RegionRouteWrapper />}
        />
      </Routes>
    </BrowserRouter>
  );
}

function RegionRouteWrapper() {
  const { regionId } = useParams();
  return regionId ? <RegionPage regionId={regionId} /> : <div>No region selected</div>;
}

export default App;
