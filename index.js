#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import { fileURLToPath } from 'url';
import ejs from 'ejs';
import shell from 'shelljs';
import ora from 'ora';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
    .version('1.0.0')
    .description('React Scaffold CLI with Microfrontend support');

// Function to prompt for inputs
async function promptUser() {
    const { appName, microfrontendCount } = await inquirer.prompt([
        { type: 'input', name: 'appName', message: 'Enter the application name:' },
        { type: 'input', name: 'appPort', message: 'Enter the Host App Port:' },
        { type: 'number', name: 'microfrontendCount', message: 'How many microfrontends?' }
    ]);

    const microfrontends = [];
    for (let i = 0; i < microfrontendCount; i++) {
        const { microfrontendName, microfrontendPort } = await inquirer.prompt([
            { type: 'input', name: 'microfrontendName', message: `Enter the name of microfrontend ${i + 1}:` },
            { type: 'number', name: 'microfrontendPort', message: `Enter the microfrontend ${i + 1} port:` }
        ]);
        microfrontends.push({
            name: microfrontendName,
            port: microfrontendPort
        });
    }

    return { appName, microfrontends };
}

// Function to generate the app from templates
async function generateApp({ appName, appPort, microfrontends }) {
    const templateDir = path.join(__dirname, 'templates');
    const appDir = path.join(process.cwd(), appName);

    // Create app directory
    fs.ensureDirSync(appDir);

    // Generate package.json, Webpack config, and other files from templates
    ejs.renderFile(path.join(templateDir, 'app', 'package.json.ejs'), { appName, microfrontends }, (err, str) => {
        if (err) throw err;
        fs.writeFileSync(path.join(appDir, 'package.json'), str);
    });

    // Generate public/index.html
    fs.ensureDirSync(path.join(appDir, 'public'));
    ejs.renderFile(path.join(templateDir, 'app', 'public', 'index.html.ejs'), { appName }, (err, str) => {
        if (err) throw err;
        fs.writeFileSync(path.join(appDir, 'public', 'index.html'), str);
    });

    // Copy and render Webpack, tsconfig, and other source files
    fs.copySync(path.join(templateDir, 'app', 'tsconfig.json.ejs'), path.join(appDir, 'tsconfig.json'));
    ejs.renderFile(path.join(templateDir, 'app', 'webpack.config.js.ejs'), { appName, appPort, microfrontends }, (err, str) => {
        if (err) throw err;
        fs.writeFileSync(path.join(appDir, 'webpack.config.js'), str);
    });


    // Generate src/index.tsx and SCSS files
    fs.ensureDirSync(path.join(appDir, 'src'));
    ejs.renderFile(path.join(templateDir, 'app', 'src', 'index.tsx.ejs'), { appName, microfrontends }, (err, str) => {
        if (err) throw err;
        fs.writeFileSync(path.join(appDir, 'src', 'index.tsx'), str);
    });
    // Copy and render declaration
    ejs.renderFile(path.join(templateDir, 'app', 'src', 'declarations.d.ts.ejs'), { appName, microfrontends }, (err, str) => {
        if (err) throw err;
        fs.writeFileSync(path.join(appDir, 'src', 'declarations.d.ts'), str);
    });
    fs.copySync(path.join(templateDir, 'app', 'src', 'styles'), path.join(appDir, 'src', 'styles'));

    // Generate microfrontends
    microfrontends.forEach(({ name, port}) => {
        const microDir = path.join(appDir, name);
        fs.ensureDirSync(microDir);
        fs.copySync(path.join(templateDir, 'microfrontend', 'tsconfig.json.ejs'), path.join(microDir, 'tsconfig.json'));
        ejs.renderFile(path.join(templateDir, 'microfrontend', 'webpack.config.js.ejs'), { name, port }, (err, str) => {
            if (err) throw err;
            fs.writeFileSync(path.join(microDir, 'webpack.config.js'), str);
        });
        ejs.renderFile(path.join(templateDir, 'microfrontend', 'package.json.ejs'), { name, port }, (err, str) => {
            if (err) throw err;
            fs.writeFileSync(path.join(microDir, 'package.json'), str);
        });
        fs.ensureDirSync(path.join(microDir, 'public'));
        ejs.renderFile(path.join(templateDir, 'microfrontend', 'public', 'index.html.ejs'), { name }, (err, str) => {
            if (err) throw err;
            fs.writeFileSync(path.join(microDir, 'public', 'index.html'), str);
        });
        fs.ensureDirSync(path.join(microDir, 'src'));
        ejs.renderFile(path.join(templateDir, 'microfrontend', 'src', 'App.tsx.ejs'), { name }, (err, str) => {
            if (err) throw err;
            fs.writeFileSync(path.join(microDir, 'src', 'App.tsx'), str);
        });
        fs.copySync(path.join(templateDir, 'microfrontend', 'src', 'boostrap.tsx.ejs'), path.join(microDir, 'src', 'boostrap.tsx'));
        fs.copySync(path.join(templateDir, 'microfrontend', 'src', 'index.tsx.ejs'), path.join(microDir, 'src', 'index.tsx'));
        
        fs.copySync(path.join(templateDir, 'microfrontend', 'src', 'styles'), path.join(microDir, 'src', 'styles'));
    });

    // Run npm install in the app directory
    shell.cd(appDir);
    // Install dependencies
    const spinner = ora('Installing dependencies...').start();
    shell.exec('npm i');
    spinner.succeed(`App ${appName} with microfrontends created successfully!`);
    console.log('');
    console.log('Install dependencies by running: npm run start:all');
}

program
    .command('create')
    .description('Create a new React app with microfrontends')
    .action(async () => {
        const userInputs = await promptUser();
        await generateApp(userInputs);
    });

program.parse(process.argv);
