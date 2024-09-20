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
		deps: "socket.io@4.7.5",
	},
	{
		name: "Strip Utility (sf-strip-2024)",
		value: "sf-strip-2024",
		repoUrl: "",
		folder: "sf-strip",
	},
];

const prompt = createPromptModule();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
prompt([
	{
		type: "list",
		name: "utility",
		message: "Which utility would you like to add?",
		choices: choices.map((choice) => ({
			name: choice.name,
			value: choice.value,
		})),
	},
])
	.then((answers) => {
		const selectedUtility = choices.find(
			(choice) => choice.value === answers.utility,
		);
		const repoUrl = selectedUtility.repoUrl;
		const utilityFolder = "./utilities";
		const tempCloneDir = path.join(__dirname, "temp-clone");
		const spinner = ora();
		spinner.succeed(`Cloning ${selectedUtility.name} from ${repoUrl}`);
		exec(
			`git clone -b ${selectedUtility.value} ${repoUrl} ${tempCloneDir}`,
			(error, stdout, stderr) => {
				if (error) {
					spinner.fail(`Error cloning repository: ${error.message}`);
					return;
				}

				spinner.start(`Copying files to ${utilityFolder}...`);
				// This makes sure the utility folder exists
				if (!fs.existsSync(utilityFolder)) {
					fs.mkdirSync(utilityFolder);
				}

				// Copy files from the cloned repo to the utility folder
				const srcFolder = path.join(tempCloneDir);
				const destFolder = path.join(utilityFolder, selectedUtility.folder);
				fse.copy(srcFolder, destFolder, (err) => {
					if (err) {
						spinner.fail(`Error copying files: ${err.message}`);
					} else {
						spinner.succeed(
							`${selectedUtility.name} has been added to your utilities folder.`,
						);
					}
					// Remove package.json and package-lock.json if they exist
					const filesToDelete = [
						"package.json",
						"package-lock.json",
						".gitignore",
						"tsconfig.json",
						".swcrc",
					];
					// Iterate over each file/directory to remove
					for (const file of filesToDelete) {
						const filePath = path.join(destFolder, file);

						try {
							// Remove the file or directory
							fs.unlink(filePath, (err) => {
								if (err) {
									spinner.fail(`Error deleting ${filePath}:`, err.message);
								}
							});
						} catch (err) {
							spinner.fail(`Error deleting ${filePath}:`, err.message);
						}
					}

					//Remove the temporary clone directory
					fse.remove(tempCloneDir, (removeErr) => {
						if (removeErr) {
							spinner.fail(
								`Error removing temporary folder: ${removeErr.message}`,
							);
						} else {
							//install deps using yarn or npm
							prompt([
								{
									type: "list",
									name: "additionalLibs",
									message: "Would you like to install additional dependencies?",
									//give 2 options either npm or yarn
									choices: [
										//if yarn is selected then install using yarn
										{
											name: "install with yarn",
											value: `yarn add ${selectedUtility.deps}`,
										},
										//if npm is selected then install using npm
										{
											name: "install with npm",
											value: `npm install ${selectedUtility.deps}`,
										},
									],
								},
							]).then((answers) => {
								spinner.start("Installing dependencies...");
								exec(answers.additionalLibs, (error, stdout, stderr) => {
									if (error) {
										spinner.fail(
											`Error installing dependencies: ${error.message}`,
										);
										return;
									}
									spinner.succeed(`Dependencies installed: ${stdout}`);
								});
							});
						}
					});
				});
			},
		);
	})
	.catch((error) => {
		const spinner = ora();
		spinner.fail("Error during inquirer prompt:", error);
	});
