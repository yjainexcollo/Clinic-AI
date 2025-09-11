
export const COPY = {
  app: {
    title: "Doctor AI - Smart Intake",
    subtitle: "Intelligent Medical Intake Interview"
  },
  form: {
    nextButton: "Next",
    startNew: "Start New Intake",
    loading: "Processing...",
    required: "This field is required",
    progressLabel: "Question"
  },
  summary: {
    title: "Intake Summary",
    subtitle: "(for clinic use)",
    complete: "Intake Complete"
  },
  errors: {
    network: "Unable to connect to the server. Please check your internet connection and try again.",
    server: "Server error occurred. Please try again later.",
    generic: "An unexpected error occurred. Please try again."
  },
  footer: {
    disclaimer: "Not for emergencies • Data encrypted in transit"
  }
} as const;
