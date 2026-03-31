import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { HashRouter, Route, Routes } from "react-router";
import Divinefont from "./components/Divinefont/Divinefont.tsx";
import Offhand from "./components/Offhand/Offhand.tsx";
import Navigation from "./components/navigation/Navigation.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/*" element={<Navigation />} />
        <Route path="/divinefont" element={<Divinefont />} />
        <Route path="/offhand" element={<Offhand />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
);
