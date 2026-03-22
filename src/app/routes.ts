import { createBrowserRouter } from "react-router";
import { LoginPage } from "./components/LoginPage";
import { StaffDashboard } from "./components/StaffDashboard";
import { AdminDashboard } from "./components/AdminDashboard";

export const router = createBrowserRouter([
  { path: "/", Component: LoginPage },
  { path: "/staff", Component: StaffDashboard },
  { path: "/admin", Component: AdminDashboard },
]);
