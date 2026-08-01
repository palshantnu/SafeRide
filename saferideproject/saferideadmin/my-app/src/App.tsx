import AppRoutes from "./routes/AppRoutes";
import { PermissionsProvider } from "./context/PermissionsContext";

function App() {
  return (
    <PermissionsProvider>
      <AppRoutes />
    </PermissionsProvider>
  );
}

export default App;