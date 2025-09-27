import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import ErrorPage from "./pages/ErrorPage";
import Home from "./pages/Home";
import Listening from "./pages/Listening";
import Song from "./pages/Song";
import Callback from "./pages/Callback";
import './index.css';
import { Analytics } from "@vercel/analytics/next"

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/listening",
    element: <Listening />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/song/:id",
    element: <Song />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/callback",
    element: <Callback />,
    errorElement: <ErrorPage />,
  },
  {
    // Catch-all route for unmatched paths
    path: "*",
    element: <ErrorPage />,
  },
]);

const root = document.getElementById("root");
ReactDOM.createRoot(root!).render(
  <React.StrictMode>
    <Analytics/>
    <RouterProvider router={router} />
  </React.StrictMode>
);