import { BrowserRouter, Routes, Route } from "react-router-dom";

import { Discovery } from "./pages/Discovery";
import { Audits } from "./pages/Audits";
import { Outreach } from "./pages/Outreach";

export function App(): React.ReactElement {
  return (
    <BrowserRouter>
      <div className="app">
        <header>
          <h1>The Closer</h1>
          <nav>
            <a href="/">Discovery</a>
            <a href="/audits">Audits</a>
            <a href="/outreach">Outreach</a>
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Discovery />} />
            <Route path="/audits" element={<Audits />} />
            <Route path="/outreach" element={<Outreach />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
