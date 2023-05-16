module.exports = {
  content: ['./views/**/*.<% if (options.ejs) { %>ejs<% } else { %>tmpl<% } %>'],
  theme: {
    extend: {}
  },
  plugins: []
}
