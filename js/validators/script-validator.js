/**
 * Script Validator — ตรวจสอบว่า script entry point มีอยู่จริง
 *                    และตรวจ basic references
 */
const ScriptValidator = (() => {
    /**
     * @param {import('../unzipper').PackInfo} pack - BP pack
     * @returns {Array}
     */
    function validate(pack) {
        const issues = [];
        if (pack.type !== 'BP') return issues;

        const { files, manifest, name } = pack;

        if (!manifest) return issues;

        // Check if script module exists
        const scriptModule = manifest.modules?.find(m => m.type === 'script');
        if (!scriptModule) return issues;

        // 1. Check entry file exists
        const entry = scriptModule.entry;
        if (!entry) {
            issues.push({
                severity: 'error',
                category: 'Script',
                message: 'Script module ไม่มี entry point',
                file: `${name}/manifest.json`,
                suggestion: 'เพิ่ม "entry": "scripts/main.js" ใน script module'
            });
            return issues;
        }

        if (!files.has(entry)) {
            issues.push({
                severity: 'error',
                category: 'Script',
                message: `ไฟล์ script entry "${entry}" ไม่มีอยู่ในแพ็ก`,
                file: `${name}/manifest.json`,
                suggestion: `สร้างไฟล์ ${entry} หรือแก้ path ใน manifest`
            });
            return issues;
        }

        // 2. Check dependencies match imports
        const scriptContent = files.get(entry);
        if (scriptContent) {
            const text = typeof scriptContent === 'string' ? scriptContent : new TextDecoder().decode(scriptContent);

            // Check if script imports modules that aren't in dependencies
            const importMatches = text.matchAll(/from\s+['"](@minecraft\/[a-z-]+)['"]/g);
            const dependencies = new Set(
                (manifest.dependencies || [])
                    .map(d => d.module_name)
                    .filter(Boolean)
            );

            for (const match of importMatches) {
                const moduleName = match[1];
                if (!dependencies.has(moduleName)) {
                    issues.push({
                        severity: 'error',
                        category: 'Script',
                        message: `Script import "${moduleName}" แต่ไม่ได้ประกาศใน manifest dependencies`,
                        file: `${name}/${entry}`,
                        suggestion: `เพิ่ม {"module_name": "${moduleName}", "version": "x.x.x"} ใน manifest dependencies`
                    });
                }
            }

            // 3. Check if script references items that exist
            const knownItems = collectItemIdentifiers(files);
            if (knownItems.size > 0) {
                // Find string literals that look like item identifiers (namespace:item_name)
                const itemRefMatches = text.matchAll(/['"]([a-z_][a-z0-9_]*:[a-z_][a-z0-9_]*)['"]/g);
                for (const match of itemRefMatches) {
                    const ref = match[1];
                    // Skip minecraft: namespace and common module names
                    if (ref.startsWith('minecraft:') || ref.startsWith('@minecraft/')) continue;
                    // Only check custom namespace items
                    if (knownItems.size > 0 && !knownItems.has(ref)) {
                        // This could be a valid identifier for something else, only warn
                        issues.push({
                            severity: 'warning',
                            category: 'Script',
                            message: `Script อ้างถึง "${ref}" แต่ไม่พบ item definition ที่มี identifier นี้`,
                            file: `${name}/${entry}`,
                            suggestion: `ตรวจสอบว่า identifier "${ref}" สะกดถูกต้อง`
                        });
                    }
                }
            }
        }

        return issues;
    }

    function collectItemIdentifiers(files) {
        const items = new Set();
        for (const [path, content] of files) {
            if (!path.match(/^items\/.*\.json$/i)) continue;
            try {
                const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                const json = JSON.parse(text);
                const id = json['minecraft:item']?.description?.identifier;
                if (id) items.add(id);
            } catch (e) {
                // ignore
            }
        }
        return items;
    }

    return { validate };
})();
