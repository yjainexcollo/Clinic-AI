import { useNavigate } from 'react-router-dom';
import { Clock, Settings, ArrowRight, CheckCircle2, Calendar } from 'lucide-react';

export const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e6f3f8] to-gray-50">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Clinic<span className="text-[#2E86AB]">AI</span> Intake Assistant
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            AI-powered clinical intake system designed for small and mid-sized clinics
          </p>
        </div>

        {/* Workflow Cards - Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 items-start">
          {/* Scheduled Visit Card */}
          <div className="medical-card hover:shadow-xl transition-all duration-300 cursor-pointer group">
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 p-4 bg-[#2E86AB]/10 rounded-full w-fit group-hover:bg-[#2E86AB]/20 transition-colors">
                <Calendar className="h-10 w-10 text-[#2E86AB]" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Scheduled Visit</h2>
              <p className="text-gray-600 text-sm">
                Patient has a scheduled appointment and will complete the intake form
              </p>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center text-sm text-gray-600">
                <CheckCircle2 className="h-4 w-4 text-[#2E86AB] mr-3 flex-shrink-0" />
                <span>Patient registration</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <CheckCircle2 className="h-4 w-4 text-[#2E86AB] mr-3 flex-shrink-0" />
                <span>Intake form completion</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <CheckCircle2 className="h-4 w-4 text-[#2E86AB] mr-3 flex-shrink-0" />
                <span>Pre-visit summary generation</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <CheckCircle2 className="h-4 w-4 text-[#2E86AB] mr-3 flex-shrink-0" />
                <span>Audio transcription & SOAP generation</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <CheckCircle2 className="h-4 w-4 text-[#2E86AB] mr-3 flex-shrink-0" />
                <span>Post-visit summary</span>
              </div>
            </div>
            
            <button
              onClick={() => navigate('/register')}
              className="w-full bg-[#2E86AB] hover:bg-[#1e5f7a] text-white font-semibold py-3.5 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Start Scheduled Visit</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          {/* Walk-In Visit Card */}
          <div className="medical-card hover:shadow-xl transition-all duration-300 cursor-pointer group">
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 p-4 bg-blue-100 rounded-full w-fit group-hover:bg-blue-200 transition-colors">
                <Clock className="h-10 w-10 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Walk-In Visit</h2>
              <p className="text-gray-600 text-sm">
                Patient is a walk-in and will go directly to consultation workflow
              </p>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center text-sm text-gray-600">
                <CheckCircle2 className="h-4 w-4 text-blue-600 mr-3 flex-shrink-0" />
                <span>Quick patient registration</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <CheckCircle2 className="h-4 w-4 text-blue-600 mr-3 flex-shrink-0" />
                <span>Unified workflow interface</span>
              </div>
              <div className="flex items-center text-sm text-gray-400">
                <CheckCircle2 className="h-4 w-4 text-gray-300 mr-3 flex-shrink-0" />
                <span className="line-through">Pre-visit summary (not applicable)</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <CheckCircle2 className="h-4 w-4 text-blue-600 mr-3 flex-shrink-0" />
                <span>Audio transcription & SOAP generation</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <CheckCircle2 className="h-4 w-4 text-blue-600 mr-3 flex-shrink-0" />
                <span>Post-visit summary</span>
              </div>
            </div>
            
            <button
              onClick={() => navigate('/walk-in')}
              className="w-full border-2 border-[#2E86AB] text-[#2E86AB] hover:bg-[#e6f3f8] font-semibold py-3.5 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md bg-white hover:border-[#1e5f7a]"
            >
              <span>Start Walk-In Visit</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Doctor Preferences */}
        <div className="flex justify-center mb-8">
          <button
            onClick={() => navigate('/doctor/preferences')}
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-medium py-3 px-6 rounded-lg transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md"
          >
            <Settings className="h-5 w-5" />
            Configure Doctor Preferences
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-sm text-gray-500">
            All information is securely stored and <span className="font-semibold text-[#2E86AB]">HIPAA compliant</span>
          </p>
        </div>
      </main>
    </div>
  );
};
