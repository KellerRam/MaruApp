// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer.minifierConfig = {
  ...config.transformer.minifierConfig,
  // Desactiva o ajusta configuraciones si es necesario, pero agregando esto evitas bloqueos de fuentes
};

config.resolver.sourceExts.push('cjs');

module.exports = config;