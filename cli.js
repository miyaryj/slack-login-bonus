const { handler } = require("./index");
const commandLineArgs = require("command-line-args");

const optionDefinitions = [{ name: "dry-run", alias: "d", type: Boolean }];

const options = commandLineArgs(optionDefinitions);

handler({
  dryRun: options["dry-run"],
});
