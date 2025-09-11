
import { v4 as uuidv4 } from 'uuid';

const SESSION_KEY = 'doctor_ai_session_id';

export class SessionManager {
  static getSessionId(): string {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) {
      return existing;
    }
    
    const newSessionId = uuidv4();
    localStorage.setItem(SESSION_KEY, newSessionId);
    return newSessionId;
  }
  
  static clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
  }
  
  static hasSession(): boolean {
    return localStorage.getItem(SESSION_KEY) !== null;
  }
}
