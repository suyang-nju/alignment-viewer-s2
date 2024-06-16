import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom"

import Chrome from './components/Chrome'
import './index.css'

const router = createBrowserRouter([
  {
    // path: "/",
    path: import.meta.env.BASE_URL,
    element: <Chrome />,
  }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
