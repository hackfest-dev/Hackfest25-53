import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Command from '../../components/dashboard/Command';

const DashboardRoutes = () => {
  return (
    <Routes>
      <Route path="/commands" element={<Command />} />
    </Routes>
  );
};

export default DashboardRoutes;