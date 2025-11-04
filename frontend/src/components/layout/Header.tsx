import { Link, useLocation } from 'react-router-dom';
import { Home, Settings, User } from 'lucide-react';
import { useAppStore } from '../../lib/store';

export const Header = () => {
  const location = useLocation();
  const { currentPatient } = useAppStore();

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <Home className="h-6 w-6 text-[#2E86AB]" />
              <span className="text-xl font-bold text-gray-900">Clinic-AI</span>
            </Link>
            <nav className="hidden md:flex space-x-1">
              <Link
                to="/"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  location.pathname === '/'
                    ? 'bg-[#2E86AB] text-white hover:bg-[#1e5f7a]'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Home className="h-4 w-4" />
                Home
              </Link>
              {currentPatient && (
                <div className="px-4 py-2 text-sm text-gray-500 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden lg:inline">{currentPatient.name}</span>
                </div>
              )}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              to="/doctor/preferences"
              className={`p-2 rounded-lg transition-colors ${
                location.pathname === '/doctor/preferences'
                  ? 'bg-[#2E86AB] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Settings className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};
