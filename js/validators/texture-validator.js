/**
 * Texture Validator — ตรวจสอบ path texture ใน attachable กับไฟล์จริง
 */
const TextureValidator = (() => {
    /**
     * @param {Array<PackInfo>} packs
     * @returns {Array}
     */
    function validate(packs) {
        const issues = [];
        const rpPacks = packs.filter(p => p.type === 'RP');

        for (const rp of rpPacks) {
            // Check all attachable texture references
            for (const [path, content] of rp.files) {
                if (!path.match(/^attachables\/.*\.json$/i)) continue;

                try {
                    const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                    const json = JSON.parse(text);
                    const desc = json['minecraft:attachable']?.description;
                    if (!desc) continue;

                    const identifier = desc.identifier || path;

                    // Check each texture reference
                    if (desc.textures) {
                        for (const [texKey, texPath] of Object.entries(desc.textures)) {
                            if (typeof texPath !== 'string') continue;

                            // Skip built-in texture references
                            if (texPath.startsWith('textures/ui/') ||
                                texPath.startsWith('textures/blocks/') ||
                                texPath.startsWith('textures/misc/')) continue;

                            const exists = fileExistsWithExtensions(rp.files, texPath, ['.png', '.tga', '.jpg', '.jpeg']);

                            if (!exists) {
                                issues.push({
                                    severity: 'error',
                                    category: 'Texture Path',
                                    message: `Attachable "${identifier}" อ้างถึง texture "${texPath}" แต่ไม่พบไฟล์`,
                                    file: `${rp.name}/${path}`,
                                    suggestion: `ตรวจสอบว่ามีไฟล์ ${texPath}.png อยู่ใน RP หรือตรวจสอบการสะกด path`
                                });
                            }
                        }
                    }
                } catch (e) {
                    // JSON error caught elsewhere
                }
            }

            // Check item_texture.json references
            const itContent = rp.files.get('textures/item_texture.json');
            if (itContent) {
                try {
                    const text = typeof itContent === 'string' ? itContent : new TextDecoder().decode(itContent);
                    const json = JSON.parse(text);
                    const textureData = json.texture_data;
                    if (textureData) {
                        for (const [key, val] of Object.entries(textureData)) {
                            const texPath = typeof val.textures === 'string'
                                ? val.textures
                                : (Array.isArray(val.textures) ? val.textures[0] : null);

                            if (texPath) {
                                const exists = fileExistsWithExtensions(rp.files, texPath, ['.png', '.tga', '.jpg', '.jpeg']);
                                if (!exists) {
                                    issues.push({
                                        severity: 'error',
                                        category: 'Texture Path',
                                        message: `item_texture.json → "${key}" อ้างถึง "${texPath}" แต่ไม่พบไฟล์`,
                                        file: `${rp.name}/textures/item_texture.json`,
                                        suggestion: `ตรวจสอบว่ามีไฟล์ ${texPath}.png อยู่จริง`
                                    });
                                }
                            }
                        }
                    }
                } catch (e) {
                    // ignore
                }
            }
        }

        return issues;
    }

    function fileExistsWithExtensions(files, basePath, extensions) {
        // Direct match (with extension already)
        if (files.has(basePath)) return true;

        // Try appending extensions
        for (const ext of extensions) {
            if (files.has(basePath + ext)) return true;
        }

        // Case-insensitive check
        const lowerBase = basePath.toLowerCase();
        for (const path of files.keys()) {
            const lowerPath = path.toLowerCase();
            if (lowerPath === lowerBase) return true;
            for (const ext of extensions) {
                if (lowerPath === lowerBase + ext) return true;
            }
        }
        return false;
    }

    return { validate };
})();
