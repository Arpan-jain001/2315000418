import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import NotificationsApp from "./pages/NotificationsApp";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<NotificationsApp view="all" />} />
        <Route path="/priority" element={<NotificationsApp view="priority" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
