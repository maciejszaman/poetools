import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { HashRouter, Route, Routes } from "react-router";
import Divinefont from "./components/Divinefont/Divinefont.tsx";
import Viscera from "./components/Viscera/Viscera.tsx";
import Navigation from "./components/navigation/Navigation.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/*" element={<Navigation />} />
        <Route path="/divinefont" element={<Divinefont />} />
        <Route path="/viscera" element={<Viscera />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
);
