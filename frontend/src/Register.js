import { useState } from "react";

function Register({ setIsLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    if (pass !== confirm) {
        setError("Passwords do not match.");
        return;
    }
    try {
      const response = await fetch("http://localhost:5001/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess("Registration successful. Go to login!");
        setError("");
      } else {
        setError(data.error);
        setSuccess("");
      }
    } catch (err) {
      setError("Server error. Is the backend running?");
    }
  };

  return (
    <div className="card">
      <h1>💧 AquaCheck</h1>
      <p>Secure your water analysis account.</p>
      <form onSubmit={handleRegister}>
        <input
          type="text"
          placeholder="New Username"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="New Password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
        />
        <input
           type="password"
           placeholder="Confirm Password"
           value={confirm}
           onChange={(e) => setConfirm(e.target.value)}
           required
         />
        {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", textAlign: "center" }}>{error}</p>}
        {success && <p style={{ color: "#10b981", fontSize: "0.8rem", textAlign: "center" }}>{success}</p>}
        <button type="submit">Register</button>
      </form>
      <button className="secondary" onClick={() => setIsLogin(true)}>
        Back to Login
      </button>
    </div>
  );
}

export default Register;