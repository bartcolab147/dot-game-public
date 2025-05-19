module.exports = {
  content: [
    './path/to/your/html/files/**/*.html', // Add the path to your HTML files
    './path/to/your/js/files/**/*.js',     // Add the path to your JS files
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('tailwind-carousel') // Make sure this line is added
  ],
}
