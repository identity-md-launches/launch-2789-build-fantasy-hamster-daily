// Optional external dependency location keeps managed workspaces free of dependency trees.
const external = process.env.FH_DEPENDENCIES;
export default {
  base: "./",
  resolve: external
    ? {
        alias: [
          {
            find: /^react-dom(\/.*)?$/,
            replacement: `${external}/react-dom$1`,
          },
          { find: /^react(\/.*)?$/, replacement: `${external}/react$1` },
        ],
      }
    : {},
  build: { target: "es2022", sourcemap: false },
};
