/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let CommandRunner;
const { spawn } = require("child_process");
const logger = require("logger-sharelatex");

logger.info("using standard command runner");

module.exports = (CommandRunner = {
	run(project_id, command, directory, image, timeout, environment, callback) {
		let key, value;
		if (callback == null) { callback = function(error) {}; }
		command = (Array.from(command).map((arg) => arg.toString().replace('$COMPILE_DIR', directory)));
		logger.log({project_id, command, directory}, "running command");
		logger.warn("timeouts and sandboxing are not enabled with CommandRunner");

		// merge environment settings
		const env = {};
		for (key in process.env) { value = process.env[key]; env[key] = value; }
		for (key in environment) { value = environment[key]; env[key] = value; }

		// run command as detached process so it has its own process group (which can be killed if needed)
		const proc = spawn(command[0], command.slice(1), {cwd: directory, env});

		let stdout = "";
		proc.stdout.on("data", data=> stdout += data);

		proc.on("error", function(err){
			logger.err({err, project_id, command, directory}, "error running command");
			return callback(err);
		});

		proc.on("close", function(code, signal) {
			let err;
			logger.info({code, signal, project_id}, "command exited");
			if (signal === 'SIGTERM') { // signal from kill method below
				err = new Error("terminated");
				err.terminated = true;
				return callback(err);
			} else if (code === 1) { // exit status from chktex
				err = new Error("exited");
				err.code = code;
				return callback(err);
			} else {
				return callback(null, {"stdout": stdout});
			}
		});

		return proc.pid;
	}, // return process id to allow job to be killed if necessary

	kill(pid, callback) {
		if (callback == null) { callback = function(error) {}; }
		try {
			process.kill(-pid); // kill all processes in group
		} catch (err) {
			return callback(err);
		}
		return callback();
	}
});