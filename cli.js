const { handler } = require("./index");
const commandLineArgs = require("command-line-args");

const optionDefinitions = [
  { name: "history", alias: "h", type: Boolean },
  { name: "dry-run", alias: "d", type: Boolean },
];

const options = commandLineArgs(optionDefinitions);

handler({
  history: options["history"],
  dryRun: options["dry-run"],
});
