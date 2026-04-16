/**
 * Unzipper — แตกไฟล์ .mcaddon / .mcpack / .zip
 * รองรับ nested zip (mcaddon ที่มี mcpack ข้างใน)
 */
const Unzipper = (() => {
    /**
     * @typedef {Object} PackInfo
     * @property {string} name - ชื่อ pack
     * @property {string} type - 'BP' | 'RP' | 'unknown'
     * @property {Map<string, Uint8Array|string>} files - Map<relativePath, content>
     * @property {Object|null} manifest - parsed manifest.json
     */

    /**
     * แตกไฟล์และจัดกลุ่มเป็น packs
     * @param {File} file
     * @param {function} onProgress
     * @returns {Promise<PackInfo[]>}
     */
    async function extract(file, onProgress) {
        onProgress && onProgress('กำลังอ่านไฟล์...', 5);
        const arrayBuffer = await file.arrayBuffer();

        onProgress && onProgress('กำลังแตกไฟล์...', 15);
        const zip = await JSZip.loadAsync(arrayBuffer);

        // Check if this is a .mcaddon (contains .mcpack files inside)
        const innerPacks = [];
        const regularFiles = new Map();
        const entries = Object.keys(zip.files);

        // Detect: does it contain .mcpack files?
        const mcpackEntries = entries.filter(e =>
            !zip.files[e].dir && (e.endsWith('.mcpack') || e.endsWith('.mcaddon'))
        );

        if (mcpackEntries.length > 0) {
            // Nested zip: .mcaddon containing .mcpack files
            onProgress && onProgress(`พบ ${mcpackEntries.length} แพ็กย่อย กำลังแตกไฟล์...`, 25);
            let i = 0;
            for (const mcpackPath of mcpackEntries) {
                i++;
                const pct = 25 + (i / mcpackEntries.length) * 40;
                onProgress && onProgress(`กำลังแตก ${getFileName(mcpackPath)}...`, pct);

                const innerData = await zip.files[mcpackPath].async('arraybuffer');
                const innerZip = await JSZip.loadAsync(innerData);
                const packFiles = await extractAllFiles(innerZip);
                const packName = getFileName(mcpackPath).replace(/\.(mcpack|mcaddon)$/i, '');
                innerPacks.push({ name: packName, files: packFiles });
            }
        } else {
            // Flat zip or single .mcpack: files directly inside
            onProgress && onProgress('กำลังอ่านไฟล์ทั้งหมด...', 30);
            const allFiles = await extractAllFiles(zip);

            // Check if there are multiple pack folders (BP+RP in subdirectories)
            const subfolders = detectPackFolders(allFiles);

            if (subfolders.length > 0) {
                for (const folder of subfolders) {
                    const packFiles = new Map();
                    for (const [path, content] of allFiles) {
                        if (path.startsWith(folder.prefix)) {
                            const relativePath = path.substring(folder.prefix.length);
                            if (relativePath) {
                                packFiles.set(relativePath, content);
                            }
                        }
                    }
                    innerPacks.push({ name: folder.name, files: packFiles });
                }
            } else {
                // Single pack (all files at root level)
                innerPacks.push({
                    name: file.name.replace(/\.(mcpack|mcaddon|zip)$/i, ''),
                    files: allFiles
                });
            }
        }

        // Classify each pack as BP or RP
        onProgress && onProgress('กำลังวิเคราะห์ประเภทแพ็ก...', 70);
        const packs = [];
        for (const pack of innerPacks) {
            const manifest = await parseManifest(pack.files);
            const type = detectPackType(manifest, pack.files, pack.name);
            packs.push({
                name: pack.name,
                type,
                files: pack.files,
                manifest
            });
        }

        onProgress && onProgress('แตกไฟล์เสร็จสิ้น', 80);
        return packs;
    }

    /**
     * Extract all files from a JSZip instance
     */
    async function extractAllFiles(zip) {
        const files = new Map();
        const promises = [];

        zip.forEach((relativePath, entry) => {
            if (!entry.dir) {
                // Normalize path separators
                const normalizedPath = relativePath.replace(/\\/g, '/');
                const isText = isTextFile(normalizedPath);
                promises.push(
                    entry.async(isText ? 'string' : 'uint8array').then(content => {
                        files.set(normalizedPath, content);
                    })
                );
            }
        });

        await Promise.all(promises);
        return files;
    }

    /**
     * Detect if a file should be read as text
     */
    function isTextFile(path) {
        const textExtensions = ['.json', '.mcfunction', '.lang', '.js', '.ts', '.txt', '.md', '.mcmeta'];
        return textExtensions.some(ext => path.toLowerCase().endsWith(ext));
    }

    /**
     * Detect pack subfolders within a flat zip
     */
    function detectPackFolders(files) {
        const folders = [];
        const manifestPaths = [];

        for (const path of files.keys()) {
            if (path.endsWith('manifest.json')) {
                manifestPaths.push(path);
            }
        }

        if (manifestPaths.length <= 1) {
            return []; // Single pack or root manifest
        }

        for (const mPath of manifestPaths) {
            const parts = mPath.split('/');
            if (parts.length >= 2) {
                const folderName = parts.slice(0, -1).join('/');
                folders.push({
                    name: parts[parts.length - 2],
                    prefix: folderName + '/'
                });
            }
        }

        return folders;
    }

    /**
     * Parse manifest.json from a pack's files
     */
    async function parseManifest(files) {
        // Try root manifest.json first
        let manifestContent = files.get('manifest.json');
        if (!manifestContent) {
            // Look for manifest in any subfolder
            for (const [path, content] of files) {
                if (path.endsWith('manifest.json')) {
                    manifestContent = content;
                    break;
                }
            }
        }

        if (!manifestContent) return null;

        try {
            const text = typeof manifestContent === 'string'
                ? manifestContent
                : new TextDecoder().decode(manifestContent);
            return JSON.parse(text);
        } catch (e) {
            return null; // Will be caught by JSON syntax validator
        }
    }

    /**
     * Detect pack type from manifest modules
     */
    function detectPackType(manifest, files, name) {
        // Try from manifest
        if (manifest && manifest.modules) {
            for (const mod of manifest.modules) {
                if (mod.type === 'data' || mod.type === 'script') return 'BP';
                if (mod.type === 'resources') return 'RP';
            }
        }

        // Try from folder name
        const lowerName = name.toLowerCase();
        if (lowerName.includes('_bp') || lowerName.endsWith('bp')) return 'BP';
        if (lowerName.includes('_rp') || lowerName.endsWith('rp')) return 'RP';

        // Try from file structure
        for (const path of files.keys()) {
            if (path.startsWith('scripts/') || path.startsWith('items/') || path.startsWith('functions/')) return 'BP';
            if (path.startsWith('textures/') || path.startsWith('attachables/') || path.startsWith('models/')) return 'RP';
        }

        return 'unknown';
    }

    function getFileName(path) {
        return path.split('/').pop();
    }

    /**
     * Build a tree structure from flat file paths for UI rendering
     */
    function buildFileTree(packs) {
        const tree = [];

        for (const pack of packs) {
            const packNode = {
                name: pack.name,
                type: 'folder',
                packType: pack.type,
                children: [],
                issues: []
            };

            const folderMap = new Map();
            const sortedPaths = [...pack.files.keys()].sort();

            for (const filePath of sortedPaths) {
                const parts = filePath.split('/');
                let currentChildren = packNode.children;

                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    const isFile = i === parts.length - 1;
                    const currentPath = parts.slice(0, i + 1).join('/');

                    if (isFile) {
                        currentChildren.push({
                            name: part,
                            type: 'file',
                            path: filePath,
                            fullPath: `${pack.name}/${filePath}`,
                            issues: []
                        });
                    } else {
                        let folder = folderMap.get(currentPath);
                        if (!folder) {
                            folder = {
                                name: part,
                                type: 'folder',
                                children: [],
                                issues: []
                            };
                            folderMap.set(currentPath, folder);
                            currentChildren.push(folder);
                        }
                        currentChildren = folder.children;
                    }
                }
            }

            tree.push(packNode);
        }

        return tree;
    }

    return {
        extract,
        buildFileTree
    };
})();
