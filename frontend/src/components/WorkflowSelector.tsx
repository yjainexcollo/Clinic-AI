import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Calendar, UserPlus, ArrowRight } from "lucide-react";

export interface WorkflowSelectorProps {
  onWorkflowSelected: (workflowType: "scheduled" | "walk-in") => void;
}

const WorkflowSelector: React.FC<WorkflowSelectorProps> = ({ onWorkflowSelected }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Clinic AI
          </h1>
          <p className="text-xl text-gray-600">
            Choose the type of patient visit to get started
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Scheduled Workflow */}
          <Card className="hover:shadow-lg transition-shadow duration-300 cursor-pointer group">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit group-hover:bg-blue-200 transition-colors">
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">Scheduled Appointment</CardTitle>
              <CardDescription className="text-gray-600">
                Patient has a scheduled appointment and will complete the intake form
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-6">
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  Patient registration
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  Intake form completion
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  Pre-visit summary generation
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  Audio transcription & SOAP generation
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  Post-visit summary
                </div>
              </div>
              <Button 
                onClick={() => onWorkflowSelected("scheduled")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Start Scheduled Visit
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Walk-in Workflow */}
          <Card className="hover:shadow-lg transition-shadow duration-300 cursor-pointer group">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-green-100 rounded-full w-fit group-hover:bg-green-200 transition-colors">
                <UserPlus className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">Walk-in Patient</CardTitle>
              <CardDescription className="text-gray-600">
                Patient is a walk-in and will skip the intake form
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-6">
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Quick patient registration
                </div>
                <div className="flex items-center text-sm text-gray-400 line-through">
                  <div className="w-2 h-2 bg-gray-300 rounded-full mr-3"></div>
                  Intake form (skipped)
                </div>
                <div className="flex items-center text-sm text-gray-400 line-through">
                  <div className="w-2 h-2 bg-gray-300 rounded-full mr-3"></div>
                  Pre-visit summary (skipped)
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Audio transcription & SOAP generation
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Post-visit summary
                </div>
              </div>
              <Button 
                onClick={() => onWorkflowSelected("walk-in")}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                Start Walk-in Visit
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Need help? Contact your system administrator for assistance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WorkflowSelector;
