
export interface MockIntakeRequest {
  question?: string | null;
  answer?: string | null;
}

export interface MockIntakeResponse {
  nextQuestion: string;
  inputType: 'text';
  summary?: string;
}

// Mock data for the three-turn demo
const mockQuestions = [
  { nextQuestion: "What brings you in today?", inputType: "text" as const },
  { nextQuestion: "How long have you had these symptoms?", inputType: "text" as const },
  { nextQuestion: "COMPLETE", inputType: "text" as const, summary: "Mock summary of answers:\n\n• Primary concern: [User's first answer]\n• Duration: [User's second answer]\n\nThis is a demo summary showing how the intake data would be processed." }
];

let currentQuestionIndex = 0;

export const fetchNext = async (question: string | null, answer: string | null): Promise<MockIntakeResponse> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  console.log('Mock fetchNext called with:', { question, answer });
  
  // First call (initialization)
  if (question === null && answer === null) {
    currentQuestionIndex = 0;
    return mockQuestions[0];
  }
  
  // Move to next question
  currentQuestionIndex++;
  
  if (currentQuestionIndex >= mockQuestions.length) {
    // Reset for next session
    currentQuestionIndex = 0;
    return mockQuestions[mockQuestions.length - 1]; // Return completion
  }
  
  return mockQuestions[currentQuestionIndex];
};

// Reset function for new sessions
export const resetMockSession = () => {
  currentQuestionIndex = 0;
};
