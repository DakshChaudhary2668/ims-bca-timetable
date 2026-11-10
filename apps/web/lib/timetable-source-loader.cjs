// Skip Next's CSS and JavaScript transforms for the standalone frontend.
module.exports = function timetableSource(source) {
  return `export default ${JSON.stringify(source)};`;
};
