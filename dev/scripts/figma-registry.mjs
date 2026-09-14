#!/usr/bin/env node

/**
 * Figma Registry Management Utility
 * Provides centralized access to Figma file keys and node mappings
 * 
 * Usage:
 *   node figma-registry.mjs list              - List all available Figma files
 *   node figma-registry.mjs get <alias>       - Get file key for alias
 *   node figma-registry.mjs validate           - Validate registry structure
 *   node figma-registry.mjs info <alias>      - Get detailed file info
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '../../');
const REGISTRY_PATH = path.join(PROJECT_ROOT, 'config/figma-registry.yaml');

/**
 * FigmaRegistry - Centralized Figma file management
 */
export class FigmaRegistry {
    constructor() {
        this.registry = this.loadRegistry();
    }

    /**
     * Load registry from YAML file
     */
    loadRegistry() {
        try {
            if (!fs.existsSync(REGISTRY_PATH)) {
                throw new Error(`Registry file not found at ${REGISTRY_PATH}`);
            }
            const content = fs.readFileSync(REGISTRY_PATH, 'utf8');
            return yaml.load(content);
        } catch (error) {
            throw new Error(`Failed to load Figma registry: ${error.message}`);
        }
    }

    /**
     * Get file key by alias
     * @param {string} alias - File alias (uses default if not provided)
     * @returns {string} Figma file key
     */
    getFileKey(alias = null) {
        const fileAlias = alias || this.registry.default;
        const file = this.registry.files[fileAlias];

        if (!file) {
            throw new Error(`Figma file '${fileAlias}' not found in registry`);
        }

        if (file.status === 'archived') {
            console.warn(`⚠️  Warning: Using archived Figma file '${fileAlias}'`);
        }

        return file.key;
    }

    /**
     * Get node ID from file's node map
     * @param {string} nodeAlias - Node alias
     * @param {string} fileAlias - File alias (uses default if not provided)
     * @returns {string} Figma node ID
     */
    getNodeId(nodeAlias, fileAlias = null) {
        const file = this.getFile(fileAlias);
        const nodeId = file.node_map?.[nodeAlias];

        if (!nodeId) {
            throw new Error(`Node '${nodeAlias}' not found in file '${file.name}'`);
        }

        return nodeId;
    }

    /**
     * Get complete file info
     * @param {string} alias - File alias (uses default if not provided)
     * @returns {object} File information
     */
    getFile(alias = null) {
        const fileAlias = alias || this.registry.default;
        const file = this.registry.files[fileAlias];

        if (!file) {
            throw new Error(`Figma file '${fileAlias}' not found in registry`);
        }

        return { ...file, alias: fileAlias };
    }

    /**
     * List all available files
     * @param {boolean} includeArchived - Include archived files
     * @returns {array} List of files
     */
    listFiles(includeArchived = false) {
        return Object.entries(this.registry.files)
            .filter(([_, file]) => includeArchived || file.status !== 'archived')
            .map(([alias, file]) => ({
                alias,
                name: file.name,
                status: file.status,
                description: file.description,
                owner: file.owner
            }));
    }

    /**
     * Get project-specific file
     * @param {string} projectName - Project name
     * @returns {object} File information
     */
    getProjectFile(projectName) {
        const project = this.registry.projects[projectName];
        if (!project) {
            throw new Error(`Project '${projectName}' not found in registry`);
        }

        return this.getFile(project.primary_file);
    }

    /**
     * Get all files for a project (primary + fallbacks)
     * @param {string} projectName - Project name
     * @returns {array} List of files
     */
    getProjectFiles(projectName) {
        const project = this.registry.projects[projectName];
        if (!project) {
            throw new Error(`Project '${projectName}' not found in registry`);
        }

        const files = [this.getFile(project.primary_file)];
        project.fallback_files?.forEach(fallback => {
            files.push(this.getFile(fallback));
        });

        return files;
    }

    /**
     * Validate registry structure
     * @returns {array} Array of error messages (empty if valid)
     */
    validate() {
        const errors = [];

        // Check default file exists
        if (!this.registry.files[this.registry.default]) {
            errors.push(`Default file '${this.registry.default}' not found`);
        }

        // Check all project references
        Object.entries(this.registry.projects || {}).forEach(([projectName, project]) => {
            if (!this.registry.files[project.primary_file]) {
                errors.push(`Project '${projectName}' references missing file '${project.primary_file}'`);
            }

            project.fallback_files?.forEach(fallback => {
                if (!this.registry.files[fallback]) {
                    errors.push(`Project '${projectName}' references missing fallback file '${fallback}'`);
                }
            });
        });

        // Check for duplicate file keys
        const keys = Object.values(this.registry.files).map(f => f.key);
        const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
        if (duplicates.length > 0) {
            errors.push(`Duplicate Figma keys found: ${duplicates.join(', ')}`);
        }

        return errors;
    }

    /**
     * Get default file
     * @returns {object} Default file information
     */
    getDefaultFile() {
        return this.getFile(this.registry.default);
    }

    /**
     * List all projects
     * @returns {array} List of projects
     */
    listProjects() {
        return Object.entries(this.registry.projects || {}).map(([name, project]) => ({
            name,
            description: project.description,
            primary_file: project.primary_file,
            fallback_files: project.fallback_files || []
        }));
    }
}

/**
 * CLI Interface
 */
if (import.meta.url === `file://${process.argv[1]}`) {
    const registry = new FigmaRegistry();
    const command = process.argv[2];

    try {
        switch (command) {
            case 'list':
                console.log('\n📋 Available Figma Files:\n');
                const files = registry.listFiles();
                files.forEach(file => {
                    const status = file.status === 'active' ? '✅' : '⚠️ ';
                    console.log(`  ${status} ${file.alias}`);
                    console.log(`     Name: ${file.name}`);
                    console.log(`     Status: ${file.status}`);
                    console.log(`     Owner: ${file.owner}`);
                    console.log(`     ${file.description}\n`);
                });
                break;

            case 'get':
                const alias = process.argv[3];
                if (!alias) {
                    console.error('❌ Error: Please specify a file alias');
                    console.error('Usage: node figma-registry.mjs get <alias>');
                    process.exit(1);
                }
                try {
                    const key = registry.getFileKey(alias);
                    console.log(`\n✅ File key for '${alias}':`);
                    console.log(`   ${key}\n`);
                } catch (error) {
                    console.error(`\n❌ Error: ${error.message}\n`);
                    process.exit(1);
                }
                break;

            case 'info':
                const infoAlias = process.argv[3];
                if (!infoAlias) {
                    console.error('❌ Error: Please specify a file alias');
                    console.error('Usage: node figma-registry.mjs info <alias>');
                    process.exit(1);
                }
                try {
                    const file = registry.getFile(infoAlias);
                    console.log(`\n📄 File Information: ${infoAlias}\n`);
                    console.log(`   Name: ${file.name}`);
                    console.log(`   Key: ${file.key}`);
                    console.log(`   Status: ${file.status}`);
                    console.log(`   Owner: ${file.owner}`);
                    console.log(`   Description: ${file.description}`);
                    console.log(`   Last Updated: ${file.last_updated}`);
                    if (file.node_map && Object.keys(file.node_map).length > 0) {
                        console.log(`\n   Node Map:`);
                        Object.entries(file.node_map).forEach(([nodeAlias, nodeId]) => {
                            console.log(`     - ${nodeAlias}: ${nodeId}`);
                        });
                    }
                    console.log();
                } catch (error) {
                    console.error(`\n❌ Error: ${error.message}\n`);
                    process.exit(1);
                }
                break;

            case 'projects':
                console.log('\n🗂️  Projects:\n');
                const projects = registry.listProjects();
                projects.forEach(project => {
                    console.log(`  📌 ${project.name}`);
                    console.log(`     ${project.description}`);
                    console.log(`     Primary: ${project.primary_file}`);
                    if (project.fallback_files.length > 0) {
                        console.log(`     Fallbacks: ${project.fallback_files.join(', ')}`);
                    }
                    console.log();
                });
                break;

            case 'validate':
                const errors = registry.validate();
                if (errors.length === 0) {
                    console.log('\n✅ Registry validation passed\n');
                } else {
                    console.log('\n❌ Registry validation failed:\n');
                    errors.forEach(error => console.log(`   - ${error}`));
                    console.log();
                    process.exit(1);
                }
                break;

            case 'default':
                try {
                    const defaultFile = registry.getDefaultFile();
                    console.log(`\n📌 Default Figma File: ${defaultFile.alias}\n`);
                    console.log(`   Name: ${defaultFile.name}`);
                    console.log(`   Key: ${defaultFile.key}`);
                    console.log(`   Status: ${defaultFile.status}\n`);
                } catch (error) {
                    console.error(`\n❌ Error: ${error.message}\n`);
                    process.exit(1);
                }
                break;

            default:
                console.log('\n📚 Figma Registry Management Utility\n');
                console.log('Usage: node figma-registry.mjs <command>\n');
                console.log('Commands:');
                console.log('  list              - List all available Figma files');
                console.log('  get <alias>       - Get file key for alias');
                console.log('  info <alias>      - Get detailed file information');
                console.log('  projects          - List all projects');
                console.log('  default           - Show default Figma file');
                console.log('  validate          - Validate registry structure\n');
        }
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}\n`);
        process.exit(1);
    }
}

export default FigmaRegistry;
