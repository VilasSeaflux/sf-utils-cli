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

const checkExistingUtility = (selectedUtility) => {
	const existingFolder = path.join(utilityFolder, selectedUtility.folder);
	return fs.existsSync(existingFolder) ? existingFolder : null;
};

const promptDeleteOldUtility = (existingFolder, selectedUtility, spinner) => {
	prompt([
		{
			type: "confirm",
			name: "deleteOld",
			message: `The utility "${selectedUtility.name}" already exists. Do you want to delete the old version and add a new one?`,
			default: false,
		},
	]).then((answers) => {
		if (answers.deleteOld) {
			fse.remove(existingFolder)
				.then(() => {
					spinner.succeed(`Old version of ${selectedUtility.name} deleted successfully.`);
					cloneRepo(selectedUtility, spinner);
				})
				.catch(handleError("Error deleting old utility"));
		} else {
			spinner.fail("Operation canceled. No changes made.");
		}
	}).catch(handleError("Error during prompt"));
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

	// Use fse.remove for each item
	const deletePromises = filesToDelete.map((file) => {
		const filePath = path.join(destFolder, file);
		return fse.remove(filePath).catch((err) => {
			console.warn(`Warning: Error deleting ${filePath}: ${err.message}`);
		});
	});

	Promise.all(deletePromises)
		.then(() => {
			// Now remove the temp clone directory
			fse.remove(tempCloneDir)
				.catch(handleError("Error removing temporary folder"));
		})
		.catch((err) => {
			console.error("Error during cleanup:", err);
		});
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

		const child = exec(installCommand, { stdio: 'pipe' }, (error, stdout, stderr) => {
			if (error) {
				spinner.fail(`Error installing dependencies: ${stderr || error.message}`);
			} else {
				spinner.succeed("Dependencies installed successfully.");
				// Optionally log the stdout if needed
				console.log(stdout);
			}
		});

		// If you want to log stdout and stderr while installing
		child.stdout.on('data', (data) => {
			// Handle stdout here if you want to log it
		});
		child.stderr.on('data', (data) => {
			// Handle stderr here if you want to log it
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
			const existingFolder = checkExistingUtility(selectedUtility);
			const spinner = ora();

			if (existingFolder) {
				promptDeleteOldUtility(existingFolder, selectedUtility, spinner);
			} else {
				cloneRepo(selectedUtility, spinner);
			}
		} else {
			ora().fail("Repository URL is missing for the selected utility.");
		}
	})
	.catch(handleError("Error during prompt"));
