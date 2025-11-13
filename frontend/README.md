
# Doctor AI - Dynamic Smart Intake Form

An intelligent medical intake application that conducts adaptive interviews using AI-powered question generation.

## Features

- **Dynamic Question Flow**: AI-powered questions that adapt based on previous answers
- **Session Management**: UUID-based session tracking with localStorage persistence
- **Progress Tracking**: Visual progress indicator with question numbering
- **Responsive Design**: Mobile-first design optimized for all screen sizes
- **Error Handling**: Graceful error handling with retry mechanisms
- **Privacy-Focused**: No PHI stored client-side, encrypted data transmission
- **Accessibility**: Screen reader friendly with proper focus management

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS with custom medical theme
- **HTTP Client**: Axios for API communication
- **Build Tool**: Vite
- **Deployment**: Vercel-ready

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Deploy to Vercel
npm run deploy
```

## API Integration

The application integrates with the backend FastAPI service:
- **Backend URL**: Configured via `VITE_BACKEND_BASE_URL` environment variable
- **Default**: `https://clinicai-backend-x7v3qgkqra-uc.a.run.app`
- **All endpoints**: Use the backend FastAPI service directly

### Patient Registration
- **Endpoint**: `POST /patients/`
- **Response**: Returns `patient_id`, `visit_id`, and `first_question`

### Intake Flow
- **Endpoint**: `POST /patients/consultations/answer`
- **Response**: Returns `next_question`, `is_complete`, `completion_percent`, etc.

All n8n webhook integrations have been removed. The system now uses the backend FastAPI service exclusively.

## Configuration

### Environment Variables
Create a `.env` file in the project root (same level as `package.json`) with the following variables:

```
VITE_BACKEND_BASE_URL=http://localhost:8000
VITE_API_KEY=your_api_key_here
```

- `VITE_BACKEND_BASE_URL`: The FastAPI backend URL (use your deployed URL in non-local environments)
- `VITE_API_KEY`: The backend API key that maps to a user in `API_KEYS` on the backend. Every request includes this key via the `X-API-Key` header for HIPAA-compliant authentication.

> **Important:** Without `VITE_API_KEY`, all API requests will receive `401 Unauthorized`. Do **not** commit real API keys to source control—use environment variables or secret managers in production.

### Customization
- **Colors**: Edit `tailwind.config.ts` to modify the medical theme colors
- **Copy**: Edit `src/copy.ts` for internationalization and text changes
- **Styling**: Modify `src/index.css` for global styles

## Security & Privacy

- **Data Encryption**: All data transmitted over HTTPS
- **Session Management**: Only session UUID stored locally
- **No PHI Storage**: No personal health information stored client-side
- **Error Handling**: Secure error messages without exposing sensitive information

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- **Bundle Size**: <200kb JavaScript bundle
- **Loading**: Progressive loading with skeleton screens
- **Responsive**: Optimized for 360px+ screen widths
- **Accessibility**: WCAG 2.1 AA compliant

## Development

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Manual Build
```bash
# Build the application
npm run build

# The built files will be in the 'dist' directory
# Upload the contents to your web server
```

## License

MIT License - see LICENSE file for details.
