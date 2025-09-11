import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import PatientDetailsForm from "./components/PatientDetailsForm";
import Index from "./pages/Index";

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/patient-registration" replace />}
        />
        <Route
          path="/patient-registration"
          element={<PatientRegistrationPage />}
        />
        <Route path="/intake/:patientId" element={<IntakePage />} />
      </Routes>
    </Router>
  );
};

// Patient Registration Page Component
const PatientRegistrationPage: React.FC = () => {
  const handlePatientCreated = (patientId: string) => {
    // Navigate to intake form with patient ID
    window.location.href = `/intake/${patientId}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-primary-light to-gray-50 flex items-center justify-center p-4">
      <PatientDetailsForm onPatientCreated={handlePatientCreated} />
    </div>
  );
};

// Intake Page Component
const IntakePage: React.FC = () => {
  return <Index />;
};

export default App;
