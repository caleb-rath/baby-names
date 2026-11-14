module.exports = function (api) {
  api.cache(true);
  return {
    // zustand's ESM build reads import.meta.env, which Metro's web bundle can't parse without this.
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
  };
};
