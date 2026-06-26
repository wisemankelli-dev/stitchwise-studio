/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Existing brand colors (rose)
        brand: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
        },
        // Floral theme - white & pink palette
        floral: {
          50: '#fffdfd',
          100: '#fff5f7',
          200: '#ffe4ed',
          300: '#ffccda',
          400: '#ffa3bf',
          500: '#ff7ea6',
          600: '#f25a8a',
          700: '#d63d72',
          800: '#b3255c',
          900: '#8c1a47',
          950: '#5c0d2e',
        },
        // Blush tones
        blush: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
          950: '#500724',
        },
        // Petal accents
        petal: {
          light: '#fff0f5',
          DEFAULT: '#ffb6c1',
          dark: '#db7090',
        },
        bloom: {
          light: '#ffe4e1',
          DEFAULT: '#ff69b4',
          dark: '#c71585',
        },
        // Garden backgrounds
        garden: {
          white: '#ffffff',
          cream: '#fefcfb',
          petal: '#fff5f7',
          rose: '#fff1f2',
          quartz: '#f8e8ef',
          pearl: '#f5f0f0',
          shell: '#fae8ed',
        },
      },
      backgroundImage: {
        'floral-gradient': 'linear-gradient(135deg, #fff5f7 0%, #fce7f3 30%, #fbcfe8 60%, #fdf2f8 100%)',
        'blush-gradient': 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 50%, #fecdd3 100%)',
        'rose-gradient': 'linear-gradient(135deg, #ffe4ed 0%, #ffccda 50%, #ffa3bf 100%)',
        'petal-gradient': 'linear-gradient(to right, #fff5f7, #ffffff, #fff5f7)',
        'floral-radial': 'radial-gradient(ellipse at center, #fff5f7 0%, #ffffff 70%)',
      },
      fontFamily: {
        script: ['"Playfair Display"', 'Georgia', 'serif'],
        elegant: ['"Lora"', 'Georgia', 'serif'],
      },
      borderRadius: {
        'floral': '2rem',
        'petal': '1.5rem',
      },
      boxShadow: {
        'blush': '0 4px 14px 0 rgba(236, 72, 153, 0.15)',
        'floral': '0 8px 32px rgba(244, 63, 94, 0.08)',
        'petal': '0 2px 8px rgba(219, 39, 119, 0.08)',
      },
      animation: {
        'bloom': 'bloom 3s ease-in-out infinite',
        'petal-fall': 'petalFall 6s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
      },
      keyframes: {
        bloom: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.05)', opacity: '0.9' },
        },
        petalFall: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)', opacity: '0.6' },
          '50%': { transform: 'translateY(-8px) rotate(5deg)', opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}