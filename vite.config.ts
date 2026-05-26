import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/rome-marathon/', // 👈 ADD THIS MATCHING YOUR EXACT GITHUB REPOSITORY NAME
})
