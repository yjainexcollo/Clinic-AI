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
import VitalsForm from "./pages/VitalsForm";
import PostVisitSummary from "./pages/PostVisitSummary";

const App: React.FC = () => {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
        <Route path="/vitals/:patientId/:visitId" element={<VitalsForm />} />
        <Route path="/post-visit/:patientId/:visitId" element={<PostVisitSummary />} />
        <Route path="*" element={<Navigate to="/patient-registration" replace />} />
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
