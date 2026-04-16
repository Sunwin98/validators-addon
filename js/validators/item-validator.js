/**
 * Item Validator — ตรวจสอบ cross-reference ระหว่าง item → icon → item_texture → texture file
 *                   และ item → attachable
 */
const ItemValidator = (() => {
    /**
     * @param {Array<PackInfo>} packs - ทุก pack (BP + RP)
     * @returns {Array}
     */
    function validate(packs) {
        const issues = [];
        const bpPacks = packs.filter(p => p.type === 'BP');
        const rpPacks = packs.filter(p => p.type === 'RP');

        for (const bp of bpPacks) {
            // Find matching RP
            const rp = findMatchingRP(bp, rpPacks);

            // Collect all items from BP
            const items = collectItems(bp);

            // Collect item_texture data from RP
            const itemTextureData = rp ? getItemTextureData(rp) : null;

            // Collect attachable identifiers from RP
            const attachableIds = rp ? getAttachableIdentifiers(rp) : new Set();

            for (const item of items) {
                // 1. Check icon → item_texture.json
                if (item.icon) {
                    if (!itemTextureData) {
                        if (rp) {
                            issues.push({
                                severity: 'error',
                                category: 'Item Cross-Reference',
                                message: `ไม่พบ textures/item_texture.json ใน RP เพื่อตรวจสอบ icon "${item.icon}"`,
                                file: item.file,
                                suggestion: 'สร้างไฟล์ textures/item_texture.json ใน Resource Pack'
                            });
                        }
                    } else {
                        if (!itemTextureData.keys.has(item.icon)) {
                            issues.push({
                                severity: 'error',
                                category: 'Item Cross-Reference',
                                message: `Icon "${item.icon}" ไม่มีอยู่ใน item_texture.json → texture_data`,
                                file: item.file,
                                suggestion: `เพิ่ม "${item.icon}" ใน texture_data ของ textures/item_texture.json ฝั่ง RP`
                            });
                        } else {
                            // Check that the texture file exists
                            const texturePath = itemTextureData.paths.get(item.icon);
                            if (texturePath && rp) {
                                const exists = fileExistsWithExtensions(rp.files, texturePath, ['.png', '.tga', '.jpg', '.jpeg']);
                                if (!exists) {
                                    issues.push({
                                        severity: 'error',
                                        category: 'Item Cross-Reference',
                                        message: `ไฟล์ texture "${texturePath}" ที่อ้างอิงจาก icon "${item.icon}" ไม่มีอยู่จริง`,
                                        file: `${rp.name}/textures/item_texture.json`,
                                        suggestion: `ตรวจสอบว่ามีไฟล์ ${texturePath}.png อยู่ใน RP`
                                    });
                                }
                            }
                        }
                    }
                }

                // 2. Check item → attachable
                if (item.identifier) {
                    if (rp && !attachableIds.has(item.identifier)) {
                        // Only warn for wearable items or non-icon items
                        if (item.isWearable) {
                            issues.push({
                                severity: 'warning',
                                category: 'Item Cross-Reference',
                                message: `Item "${item.identifier}" ไม่มี attachable คู่ใน RP`,
                                file: item.file,
                                suggestion: `สร้าง attachable JSON ที่มี identifier "${item.identifier}" ใน RP/attachables/`
                            });
                        }
                    }
                }
            }
        }

        return issues;
    }

    function collectItems(bp) {
        const items = [];
        for (const [path, content] of bp.files) {
            if (!path.match(/^items\/.*\.json$/i)) continue;

            try {
                const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                const json = JSON.parse(text);
                const itemDef = json['minecraft:item'];
                if (!itemDef) continue;

                const identifier = itemDef.description?.identifier;
                const components = itemDef.components || {};
                const icon = components['minecraft:icon']?.texture || components['minecraft:icon'];
                const isWearable = !!components['minecraft:wearable'];

                items.push({
                    identifier,
                    icon: typeof icon === 'string' ? icon : null,
                    isWearable,
                    file: `${bp.name}/${path}`
                });
            } catch (e) {
                // JSON parse error will be caught by JsonSyntaxValidator
            }
        }
        return items;
    }

    function getItemTextureData(rp) {
        const itPath = findFile(rp.files, 'textures/item_texture.json');
        if (!itPath) return null;

        try {
            const content = rp.files.get(itPath);
            const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
            const json = JSON.parse(text);
            const textureData = json.texture_data;
            if (!textureData) return null;

            const keys = new Set(Object.keys(textureData));
            const paths = new Map();

            for (const [key, val] of Object.entries(textureData)) {
                const texPath = typeof val.textures === 'string'
                    ? val.textures
                    : (Array.isArray(val.textures) ? val.textures[0] : null);
                if (texPath) {
                    paths.set(key, texPath);
                }
            }

            return { keys, paths };
        } catch (e) {
            return null;
        }
    }

    function getAttachableIdentifiers(rp) {
        const ids = new Set();
        for (const [path, content] of rp.files) {
            if (!path.match(/^attachables\/.*\.json$/i)) continue;
            try {
                const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                const json = JSON.parse(text);
                const id = json['minecraft:attachable']?.description?.identifier;
                if (id) ids.add(id);
            } catch (e) {
                // ignore
            }
        }
        return ids;
    }

    function findMatchingRP(bp, rpPacks) {
        if (rpPacks.length === 1) return rpPacks[0];
        // Try matching by name
        const bpBase = bp.name.replace(/_?BP$/i, '').toLowerCase();
        return rpPacks.find(rp => {
            const rpBase = rp.name.replace(/_?RP$/i, '').toLowerCase();
            return rpBase === bpBase;
        }) || rpPacks[0] || null;
    }

    function findFile(files, target) {
        if (files.has(target)) return target;
        for (const path of files.keys()) {
            if (path.toLowerCase() === target.toLowerCase()) return path;
        }
        return null;
    }

    function fileExistsWithExtensions(files, basePath, extensions) {
        for (const ext of extensions) {
            if (files.has(basePath + ext) || files.has(basePath)) return true;
        }
        // Also check with lowercase
        const lowerBase = basePath.toLowerCase();
        for (const [path] of files) {
            const lowerPath = path.toLowerCase();
            for (const ext of extensions) {
                if (lowerPath === lowerBase + ext || lowerPath === lowerBase) return true;
            }
        }
        return false;
    }

    return { validate };
})();
