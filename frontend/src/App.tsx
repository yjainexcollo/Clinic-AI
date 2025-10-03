import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import PersonalForm from "./components/PersonalForm";
import Navigation from "./components/Navigation";
import Index from "./pages/Index";
import SoapSummary from "./pages/SoapSummary";
import VitalsForm from "./pages/VitalsForm";
import TranscriptUpload from "./pages/TranscriptUpload";
import AdhocTranscribe from "./pages/AdhocTranscribe";
import DoctorPreferences from "./pages/DoctorPreferences";
import PostVisitSummary from "./pages/PostVisitSummary";
import AudioManagement from "./pages/AudioManagement";

// Conditional Navigation Component
const ConditionalNavigation: React.FC = () => {
  const location = useLocation();
  
  // Only show navigation on the audio page
  const shouldShowNav = location.pathname === '/audio';
  
  return shouldShowNav ? <Navigation /> : null;
};

const App: React.FC = () => {
  return (
    <Router>
      <ConditionalNavigation />
      <Routes>
  <Route path="/" element={<Navigate to="/patient-registration" replace />} />
  <Route path="/patient-registration" element={<PatientRegistrationPage />} />
  <Route path="/intake/:patientId" element={<IntakePage />} />
  <Route path="/soap/:patientId/:visitId" element={<SoapSummary />} />
  <Route path="/vitals/:patientId/:visitId" element={<VitalsForm />} />
  <Route path="/transcribe/:patientId/:visitId" element={<TranscriptUpload />} />
  <Route path="/transcribe/adhoc" element={<AdhocTranscribe />} />
  <Route path="/doctor/preferences" element={<DoctorPreferences />} />
  <Route path="/post-visit/:patientId/:visitId" element={<PostVisitSummary />} />
  <Route path="/audio" element={<AudioManagement />} />
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
