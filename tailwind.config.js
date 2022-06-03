module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      width: {
        '21': '5.25rem',
        '27': '6.75rem'
      },
      colors: {
        'slate-250': '#D7DFE9',
        'slate-350': '#B0BCCD',
        'slate-450': '#7C8CA2',
        'slate-550': '#56657A'
      },
      transitionProperty: {
        'header': 'top, margin, left, right, transform'
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(1, -0.5, 0, 1.5)',
        'bounce-out': 'cubic-bezier(1, 0.5, 0, 1.5)',
      },
      zIndex: {
        '999': '999',
        '1000': '1000',
        '1250': '1250',
        '1499': '1499',
        '1500': '1500',
        '9999': '9999'
      }
    },
  },
  plugins: [],
}
