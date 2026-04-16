/**
 * Function Validator — ตรวจสอบ tick.json → mcfunction ว่ามีไฟล์จริง
 *                      และ item references ใน mcfunction ว่าถูกต้อง
 */
const FunctionValidator = (() => {
    /**
     * @param {import('../unzipper').PackInfo} pack - BP pack
     * @returns {Array}
     */
    function validate(pack) {
        const issues = [];
        if (pack.type !== 'BP') return issues;

        const { files, name } = pack;

        // 1. Check tick.json
        const tickContent = files.get('functions/tick.json');
        if (tickContent) {
            try {
                const text = typeof tickContent === 'string' ? tickContent : new TextDecoder().decode(tickContent);
                const json = JSON.parse(text);

                if (json.values && Array.isArray(json.values)) {
                    for (const funcName of json.values) {
                        // Check if the .mcfunction file exists
                        const funcPath = `functions/${funcName}.mcfunction`;
                        if (!files.has(funcPath)) {
                            issues.push({
                                severity: 'error',
                                category: 'Function',
                                message: `tick.json อ้างถึง function "${funcName}" แต่ไม่พบไฟล์ ${funcPath}`,
                                file: `${name}/functions/tick.json`,
                                suggestion: `สร้างไฟล์ ${funcPath} หรือแก้ชื่อใน tick.json`
                            });
                        }
                    }
                }
            } catch (e) {
                // JSON error caught elsewhere
            }
        }

        // 2. Check item references inside mcfunction files
        const knownItems = collectItemIdentifiers(files);

        for (const [path, content] of files) {
            if (!path.endsWith('.mcfunction')) continue;

            const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
            const lines = text.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('#') || line === '') continue;

                // Find hasitem={item=xxx} references
                const itemMatches = line.matchAll(/item=([a-z_][a-z0-9_:]*)/gi);
                for (const match of itemMatches) {
                    const itemId = match[1];
                    if (knownItems.size > 0 && !knownItems.has(itemId)) {
                        issues.push({
                            severity: 'warning',
                            category: 'Function',
                            message: `mcfunction อ้างถึง item "${itemId}" แต่ไม่พบ item นี้ใน BP/items/`,
                            file: `${name}/${path}`,
                            suggestion: `ตรวจสอบว่า identifier "${itemId}" สะกดถูกต้องและมี item definition`
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
