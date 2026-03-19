/* eslint-disable @typescript-eslint/no-require-imports */
const { runAnalysis } = require("../../lib/analyze.ts");

runAnalysis()
  .then((stats) => {
    console.log(JSON.stringify(stats, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
