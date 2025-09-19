import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import PersonalForm from "./components/PersonalForm";
import Index from "./pages/Index";
import SoapSummary from "./pages/SoapSummary";

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
        <Route path="/soap/:patientId/:visitId" element={<SoapSummary />} />
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

  return <PersonalForm onPatientCreated={handlePatientCreated} />;
};

// Intake Page Component
const IntakePage: React.FC = () => {
  return <Index />;
};

export default App;
