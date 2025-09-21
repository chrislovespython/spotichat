import { Routes, Route } from "react-router"
import Home from "./pages/Home"
import Listening from "./pages/Listening"
import Song from "./pages/Song"
import Navbar from "./components/Navbar"
import Callback from "./pages/Callback"

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/listening" element={<Listening />} />
        <Route path="/song/:id" element={<Song />} />
        <Route path="/callback" element={<Callback/>}></Route>
      </Routes>
    </div>
  )
}
