import { useState } from "react";

const products = [
  { name: "Milk", price: 40 },
  { name: "Bread", price: 30 },
  { name: "Chips", price: 20 },
  { name: "Bottle", price: 25 },
];

function Home({ setIsLoggedIn }) {
  const [cart, setCart] = useState([]);

  const addItem = (item) => {
    setCart([...cart, item]);
  };

  const removeItem = (index) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const total = cart.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="dashboard">
      <h1>✨ Smart AI Billing</h1>
        <p>Fast • Smart • Contactless</p>
      <button className="logout" onClick={() => setIsLoggedIn(false)}>
        Logout
      </button>

      {/* 🔍 SCAN SECTION */}
      <div className="card">
        <h2>📷 Scan Product (AI Module)</h2>
        <button>Start Camera</button>
        <p>(Camera integration comes later)</p>
      </div>

      {/* ➕ ADD PRODUCTS */}
      <div className="card">
        <h2>➕ Add Items</h2>

        {products.map((p, i) => (
          <div key={i}>
            {p.name} - ₹{p.price}
            <button onClick={() => addItem(p)}>Add</button>
          </div>
        ))}
      </div>

      {/* 🧾 BILLING */}
      <div className="card">
        <h2>🧾 Cart</h2>

        {cart.map((item, index) => (
          <div key={index}>
            {item.name} - ₹{item.price}
            <button onClick={() => removeItem(index)}>Remove</button>
          </div>
        ))}

        <h3>Total: ₹{total}</h3>
      </div>
    </div>
  );
}

export default Home;