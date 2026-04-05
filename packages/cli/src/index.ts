import { createCli } from "./cli.js";
import { classifyInvocation } from "./classify.js";
import { openDesktopWithProject } from "./commands/open.js";

const program = createCli();
const knownCommands = new Set(program.commands.map((command) => command.name()));

const invocation = classifyInvocation({
  argv: process.argv.slice(2),
  knownCommands,
  cwd: process.cwd(),
});

switch (invocation.kind) {
  case "cli": {
    const argv = [...process.argv.slice(0, 2), ...invocation.argv];
    if (invocation.argv.length === 0) {
      argv.push("onboard");
    }
    program.parse(argv, { from: "node" });
    break;
  }
  case "open-project":
    await openDesktopWithProject(invocation.resolvedPath);
    break;
}
