// metro.config.js (project root)
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Ensure a single instance of 'three' gets bundled
config.resolver.alias = {
  three: path.resolve(__dirname, 'node_modules/three'),
  'three/examples/jsm': path.resolve(__dirname, 'node_modules/three/examples/jsm'),
};

module.exports = config;