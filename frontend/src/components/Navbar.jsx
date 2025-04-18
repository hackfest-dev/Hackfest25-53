import React from 'react';
import { NavLink } from 'react-router-dom';

function Navbar() {
  return (
    <nav className="app-nav">
      <NavLink to="/" end>Dashboard</NavLink>
      <NavLink to="/whatsapp">WhatsApp Bot</NavLink>
      <NavLink to="/commands">Command Panel</NavLink>
      <NavLink to="/screenshots">Screenshot Panel</NavLink>
    </nav>
  );
}

export default Navbar;
