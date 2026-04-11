function Dashboard({ setIsLoggedIn, setPage }) {
  return (
    <div className="dashboard">
      <h1>Welcome Shop Owner 👋</h1>

      <div className="card">
        <h2>Billing System</h2>
        <button onClick={() => setPage("billing")}>
          Start Billing
        </button>
      </div>

      <button className="logout" onClick={() => setIsLoggedIn(false)}>
        Logout
      </button>
    </div>
  );
}

export default Dashboard;