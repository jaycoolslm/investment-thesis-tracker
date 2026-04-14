import { Routes, Route } from "react-router";
import { Layout } from "./components/Layout.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { ThesisDetailPage } from "./pages/ThesisDetailPage.tsx";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="holdings/:holdingId" element={<ThesisDetailPage />} />
      </Route>
    </Routes>
  );
}
