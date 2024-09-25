#!/usr/bin/env node

import fse from "fs-extra";
import { createPromptModule } from "inquirer";
import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ora from "ora";

const choices = [
	{
		name: "Socket Utility (sf-socket-2024)",
		value: "feature/sf-socketio",
		folder: "sf-socketio",
		repoUrl: "git@git.seaflux.dev:boilerplates/utility-library-nodets.git",
		deps: "jm-ez-l10n@1.0.0 moment@2.30.1 morgan@1.9.1 socket.io@4.7.5 uuid@8.3.2 winston@3.14.2 redis@4.7.0",
		devDeps: "@types/moment@2.13.0 @types/node-uuid@0.0.28",
	},
	{
		name: "Strip Utility (sf-strip-2024)",
		value: "sf-strip-2024",
		repoUrl: "",
		folder: "sf-stripe",
		deps: ""
	},
];

const prompt = createPromptModule();
const rootDir = process.cwd(); // Get the current working directory (root)
const utilityFolder = path.join(rootDir, "src", "utilities"); // Set utilities path
const tempCloneDir = path.join(rootDir, "temp-clone");

const handleError = (message) => (error) => {
	if (error) {
		const spinner = ora();
		spinner.fail(`${message}: ${error.message}`);
	}
};

const cloneRepo = (selectedUtility, spinner) => {
	spinner.start(`Cloning ${selectedUtility.name} from ${selectedUtility.repoUrl}`);
	exec(
		`git clone -b ${selectedUtility.value} ${selectedUtility.repoUrl} ${tempCloneDir}`,
		(error) => {
			handleError("Error cloning repository")(error);
			spinner.succeed(`${selectedUtility.name} cloned successfully.`);
			copyFiles(selectedUtility, spinner);
		}
	);
};

const createUtilityFolder = () => {
	if (!fs.existsSync(utilityFolder)) {
		fs.mkdirSync(utilityFolder, { recursive: true });
	}
	return utilityFolder;
};

const copyFiles = (selectedUtility, spinner) => {
	const destFolder = path.join(createUtilityFolder(), selectedUtility.folder);
	fse.copy(tempCloneDir, destFolder, (err) => {
		handleError("Error copying files")(err);
		spinner.succeed(`${selectedUtility.name} has been added to your utilities folder.`);
		cleanup(destFolder);
		// Call installDependencies after copying files
		installDependencies(selectedUtility, spinner);
	});
};

const cleanup = (destFolder) => {
	const filesToDelete = [
		"package.json",
		"package-lock.json",
		".gitignore",
		".git",
		"tsconfig.json",
		".swcrc",
	];
	filesToDelete.forEach((file) => {
		const filePath = path.join(destFolder, file);
		fs.unlink(filePath, handleError(`Error deleting ${filePath}`));
	});
	fse.remove(tempCloneDir, handleError("Error removing temporary folder"));
};

const installDependencies = (selectedUtility, spinner) => {
	prompt([
		{
			type: "list",
			name: "additionalLibs",
			message: "Would you like to install additional dependencies?",
			choices: [
				{
					name: "Install with Yarn",
					value: `yarn add ${selectedUtility.deps} && yarn add --dev ${selectedUtility.devDeps}`,
				},
				{
					name: "Install with NPM",
					value: `npm install ${selectedUtility.deps} && npm install --save-dev ${selectedUtility.devDeps}`,
				},
			],
		},
	]).then((answers) => {
		const installCommand = answers.additionalLibs;
		spinner.start("Installing dependencies...");

		const child = exec(installCommand, { stdio: 'inherit' }, (error) => {
			handleError("Error installing dependencies")(error);
			spinner.succeed(`Dependencies installed successfully.`);
		});
	});
};

prompt([
	{
		type: "list",
		name: "utility",
		message: "Which utility would you like to add?",
		choices: choices.map((choice) => ({ name: choice.name, value: choice.value })),
	},
])
	.then((answers) => {
		const selectedUtility = choices.find((choice) => choice.value === answers.utility);
		if (selectedUtility.repoUrl) {
			const spinner = ora();
			cloneRepo(selectedUtility, spinner);
		} else {
			ora().fail("Repository URL is missing for the selected utility.");
		}
	})
	.catch(handleError("Error during prompt"));
