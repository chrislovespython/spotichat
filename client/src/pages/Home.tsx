import { useEffect } from "react"

export default function Home() {
  const login = async () => {
    const res = await fetch("https://spotichat-backend.vercel.app/auth/login")
    const data = await res.json()
    window.location.href = data.url
  }

  const logout = () => {
    localStorage.removeItem("spotify_token")
    window.location.href = "/"
  }

  useEffect(() => {
    return () => {
      if (localStorage.getItem("spotify_token")) {
        window.location.href = "/listening"
      }
    };
  }, [])

  return (
    <main className="flex flex-col items-center justify-center h-screen w-screen">
      <h1 className="text-5xl font-bold md:text-6xl">Liscuss.</h1>
      <h5 className="text-base-content/70 my-4 text-center w-96 font-semibold italic md:text-2xl md:w-[32rem] max-sm:w-80">Drop your thoughts on any song in real-time as it plays. Keep it simple: lis(ten) and dis(cuss).</h5>

      {localStorage.getItem("spotify_token") ? (
        <div>
          <button className="btn btn-error md:text-xl" onClick={logout}>Logout</button>
        </div>
      ) : (
        <button className="btn btn-neutral md:text-lg" onClick={login}>Login with Spotify</button>
      )}
      <footer className="mt-4">
        <h1 className="italic text-lg font-semibold text-base-content/70 max-sm:text-sm">Made by <a className="link link-hover" href="http://x.com/@chrisawesomer_" target="_blank">chris (chrisawesomer)</a></h1>
      </footer>
      
    </main>
  )
}
