import twColors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Core brand greens — driven by CSS vars so per-clinic custom theming
        // can override them at runtime. Pine leads, Spruce/seafoam accents.
        pine: 'rgb(var(--secondary-rgb) / <alpha-value>)',
        seafoam: 'rgb(var(--primary-rgb) / <alpha-value>)',
        spruce: '#1C7A5B',
        // Signal + neutrals from the VetHub Core brand palette.
        // amber/cyan keep the brand tone as DEFAULT (`bg-amber`, `bg-cyan`)
        // but ALSO keep Tailwind's full 50–950 scale — a flat value here
        // silently deletes the scale, turning every `bg-amber-100` /
        // `bg-cyan-600` in the app into a no-op (invisible buttons).
        amber: { ...twColors.amber, DEFAULT: '#F2A41C' },
        bronze: '#9A4E0E',
        espresso: '#2A1A11',
        mint: '#CFE6D8',
        sage: '#EAF0EA',
        cream: '#F6F4EF',
        mist: '#CFE6D8',
        cyan: { ...twColors.cyan, DEFAULT: '#2EA1B8' },
      },
      fontFamily: {
        // Hanken Grotesk = body/long-form/tables; Sora = display/headings/UI.
        sans: ['Hanken Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Hanken Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

