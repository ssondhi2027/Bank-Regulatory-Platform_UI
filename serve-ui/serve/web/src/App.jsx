import { useState } from "react";
import Layout from "./components/Layout.jsx";
import Scorecard from "./pages/Scorecard.jsx";
import Business from "./pages/Business.jsx";

export default function App() {
  const [page, setPage] = useState("business");

  return (
    <Layout page={page} onNavigate={setPage}>
      {page === "scorecard" ? <Scorecard /> : <Business />}
    </Layout>
  );
}
