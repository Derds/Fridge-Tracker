function App() {
  return (
    <div className="min-h-screen bg-base-100">
      <div className="navbar bg-base-200 shadow-sm">
        <span className="navbar-brand text-xl font-bold text-primary">🥦 Fridge Inventory</span>
      </div>
      <main className="container mx-auto p-4">
        <div className="hero min-h-[60vh]">
          <div className="hero-content text-center">
            <div>
              <h1 className="text-4xl font-bold">Welcome to Fridge Inventory</h1>
              <p className="py-4 text-base-content/70">Your personal fridge and pantry tracker. Coming soon.</p>
              <button className="btn btn-primary">Get Started</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App

