/**
 * Centralized Application Configuration
 * Defaults to the production Render backend URL while allowing local override via VITE_API_BASE_URL.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://digiplus-backend.onrender.com/api'
