/**
 * Unused Assets Validator — ตรวจหาสิ่งที่มีอยู่แต่ไม่ถูกเรียกใช้
 *   - Animation ที่ไม่ได้ถูกอ้างอิงจาก attachable
 *   - Geometry/Model ที่ไม่ได้ถูกอ้างอิงจาก attachable
 *   - Texture file ที่ไม่ได้ถูกอ้างอิงจากที่ไหนเลย
 *   - item_texture.json entry ที่ไม่ได้ถูกใช้โดย item ใดๆ
 *   - Attachable ที่ไม่มี item คู่ใน BP
 */
const UnusedValidator = (() => {

    /**
     * @param {Array<PackInfo>} packs
     * @returns {Array}
     */
    function validate(packs) {
        const issues = [];
        const bpPacks = packs.filter(p => p.type === 'BP');
        const rpPacks = packs.filter(p => p.type === 'RP');

        for (const rp of rpPacks) {
            const bp = findMatchingBP(rp, bpPacks);

            // Collect all references FROM attachables (what they actually use)
            const refs = collectAttachableRefs(rp);

            // 1. Unused Animations
            checkUnusedAnimations(rp, refs.usedAnimations, issues);

            // 2. Unused Geometries/Models
            checkUnusedGeometries(rp, refs.usedGeometries, issues);

            // 3. Unused Skin Textures (textures/skin/)
            checkUnusedSkinTextures(rp, refs.usedTexturePaths, issues);

            // 4. Unused item_texture entries (not referenced by any BP item icon)
            if (bp) {
                checkUnusedItemTextureEntries(rp, bp, issues);
            }

            // 5. Unused Item Textures (textures/items/ files not in item_texture.json)
            checkUnusedItemTextureFiles(rp, issues);

            // 6. Attachables without matching BP items
            if (bp) {
                checkOrphanAttachables(rp, bp, issues);
            }
        }

        // 7. BP: items not referenced in scripts or functions
        for (const bp of bpPacks) {
            checkUnreferencedItems(bp, issues);
        }

        return issues;
    }

    // ========================================
    // Collect all references from attachables
    // ========================================
    function collectAttachableRefs(rp) {
        const usedAnimations = new Set();
        const usedGeometries = new Set();
        const usedTexturePaths = new Set();

        for (const [path, content] of rp.files) {
            if (!path.match(/^attachables\/.*\.json$/i)) continue;

            try {
                const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                const json = JSON.parse(text);
                const desc = json['minecraft:attachable']?.description;
                if (!desc) continue;

                // Animations used
                if (desc.animations) {
                    for (const animRef of Object.values(desc.animations)) {
                        if (typeof animRef === 'string') usedAnimations.add(animRef);
                    }
                }

                // Geometries used
                if (desc.geometry) {
                    for (const geoRef of Object.values(desc.geometry)) {
                        if (typeof geoRef === 'string') usedGeometries.add(geoRef);
                    }
                }

                // Texture paths used
                if (desc.textures) {
                    for (const texPath of Object.values(desc.textures)) {
                        if (typeof texPath === 'string') {
                            usedTexturePaths.add(texPath);
                            // Also add with common extensions
                            usedTexturePaths.add(texPath + '.png');
                            usedTexturePaths.add(texPath + '.tga');
                        }
                    }
                }
            } catch (e) { /* skip */ }
        }

        return { usedAnimations, usedGeometries, usedTexturePaths };
    }

    // ========================================
    // 1. Unused Animations
    // ========================================
    function checkUnusedAnimations(rp, usedAnimations, issues) {
        for (const [path, content] of rp.files) {
            if (!path.match(/\.animation\.json$/i) && !path.match(/^animations\/.*\.json$/i)) continue;

            try {
                const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                const json = JSON.parse(text);

                if (!json.animations) continue;

                for (const animId of Object.keys(json.animations)) {
                    if (!usedAnimations.has(animId)) {
                        issues.push({
                            severity: 'warning',
                            category: 'ไม่ได้ใช้งาน',
                            message: `Animation "${animId}" ถูกประกาศแต่ไม่มี attachable ใดเรียกใช้`,
                            file: `${rp.name}/${path}`,
                            suggestion: 'ถ้าไม่ได้ใช้แล้ว สามารถลบออกเพื่อลดขนาดแพ็กได้ หรือตรวจสอบว่าลืมเชื่อมใน attachable หรือเปล่า'
                        });
                    }
                }
            } catch (e) { /* skip */ }
        }
    }

    // ========================================
    // 2. Unused Geometries
    // ========================================
    function checkUnusedGeometries(rp, usedGeometries, issues) {
        for (const [path, content] of rp.files) {
            if (!path.match(/\.geo\.json$/i) && !path.match(/^models\/.*\.json$/i)) continue;

            try {
                const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                const json = JSON.parse(text);

                // Format: minecraft:geometry array
                const geoIds = [];

                if (json['minecraft:geometry'] && Array.isArray(json['minecraft:geometry'])) {
                    for (const geo of json['minecraft:geometry']) {
                        if (geo.description?.identifier) {
                            geoIds.push(geo.description.identifier);
                        }
                    }
                }

                // Legacy/old format: keys starting with geometry.
                for (const key of Object.keys(json)) {
                    if (key.startsWith('geometry.')) {
                        geoIds.push(key);
                    }
                }

                for (const geoId of geoIds) {
                    // Skip utility geometries (like geometry.air)
                    if (geoId === 'geometry.air') continue;

                    if (!usedGeometries.has(geoId)) {
                        issues.push({
                            severity: 'warning',
                            category: 'ไม่ได้ใช้งาน',
                            message: `Geometry "${geoId}" ถูกประกาศแต่ไม่มี attachable ใดเรียกใช้`,
                            file: `${rp.name}/${path}`,
                            suggestion: 'ตรวจสอบว่าลืมเชื่อม geometry นี้ใน attachable หรือลบออกถ้าไม่ต้องการ'
                        });
                    }
                }
            } catch (e) { /* skip */ }
        }
    }

    // ========================================
    // 3. Unused Skin Textures
    // ========================================
    function checkUnusedSkinTextures(rp, usedTexturePaths, issues) {
        for (const path of rp.files.keys()) {
            // Only check textures/skin/ folder
            if (!path.match(/^textures\/skin\/.*\.(png|tga|jpg|jpeg)$/i)) continue;

            // Build the path without extension (how it's referenced in JSON)
            const pathNoExt = path.replace(/\.(png|tga|jpg|jpeg)$/i, '');

            if (!usedTexturePaths.has(path) && !usedTexturePaths.has(pathNoExt)) {
                issues.push({
                    severity: 'warning',
                    category: 'ไม่ได้ใช้งาน',
                    message: `Texture "${path}" มีอยู่ในแพ็กแต่ไม่มี attachable ใดอ้างอิงถึง`,
                    file: `${rp.name}/${path}`,
                    suggestion: 'ตรวจสอบว่าลืมเชื่อม texture นี้ใน attachable หรือลบออกถ้าไม่ต้องการ'
                });
            }
        }
    }

    // ========================================
    // 4. Unused item_texture.json entries
    // ========================================
    function checkUnusedItemTextureEntries(rp, bp, issues) {
        const itContent = rp.files.get('textures/item_texture.json');
        if (!itContent) return;

        try {
            const text = typeof itContent === 'string' ? itContent : new TextDecoder().decode(itContent);
            const json = JSON.parse(text);
            const textureData = json.texture_data;
            if (!textureData) return;

            // Collect all icon references from BP items
            const usedIcons = new Set();
            for (const [path, content] of bp.files) {
                if (!path.match(/^items\/.*\.json$/i)) continue;
                try {
                    const itemText = typeof content === 'string' ? content : new TextDecoder().decode(content);
                    const itemJson = JSON.parse(itemText);
                    const components = itemJson['minecraft:item']?.components;
                    if (!components) continue;
                    const icon = components['minecraft:icon']?.texture || components['minecraft:icon'];
                    if (typeof icon === 'string') usedIcons.add(icon);
                } catch (e) { /* skip */ }
            }

            for (const key of Object.keys(textureData)) {
                if (!usedIcons.has(key)) {
                    issues.push({
                        severity: 'warning',
                        category: 'ไม่ได้ใช้งาน',
                        message: `item_texture entry "${key}" ไม่ถูกใช้โดย item ใดใน BP`,
                        file: `${rp.name}/textures/item_texture.json`,
                        suggestion: 'ตรวจสอบว่าลืมตั้ง minecraft:icon ใน item หรือลบ entry นี้ออก'
                    });
                }
            }
        } catch (e) { /* skip */ }
    }

    // ========================================
    // 5. Unused textures/items/ files
    // ========================================
    function checkUnusedItemTextureFiles(rp, issues) {
        const itContent = rp.files.get('textures/item_texture.json');
        const referencedPaths = new Set();

        if (itContent) {
            try {
                const text = typeof itContent === 'string' ? itContent : new TextDecoder().decode(itContent);
                const json = JSON.parse(text);
                const textureData = json.texture_data;
                if (textureData) {
                    for (const val of Object.values(textureData)) {
                        const texPath = typeof val.textures === 'string'
                            ? val.textures
                            : (Array.isArray(val.textures) ? val.textures[0] : null);
                        if (texPath) {
                            referencedPaths.add(texPath);
                            referencedPaths.add(texPath + '.png');
                            referencedPaths.add(texPath + '.tga');
                        }
                    }
                }
            } catch (e) { /* skip */ }
        }

        // Also collect texture references from attachables (some use items/ textures directly)
        for (const [path, content] of rp.files) {
            if (!path.match(/^attachables\/.*\.json$/i)) continue;
            try {
                const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                const json = JSON.parse(text);
                const textures = json['minecraft:attachable']?.description?.textures;
                if (textures) {
                    for (const texPath of Object.values(textures)) {
                        if (typeof texPath === 'string') {
                            referencedPaths.add(texPath);
                            referencedPaths.add(texPath + '.png');
                            referencedPaths.add(texPath + '.tga');
                        }
                    }
                }
            } catch (e) { /* skip */ }
        }

        for (const filePath of rp.files.keys()) {
            if (!filePath.match(/^textures\/items\/.*\.(png|tga|jpg|jpeg)$/i)) continue;

            const pathNoExt = filePath.replace(/\.(png|tga|jpg|jpeg)$/i, '');

            if (!referencedPaths.has(filePath) && !referencedPaths.has(pathNoExt)) {
                issues.push({
                    severity: 'warning',
                    category: 'ไม่ได้ใช้งาน',
                    message: `Texture "${filePath}" มีอยู่แต่ไม่ถูกอ้างอิงใน item_texture.json หรือ attachable`,
                    file: `${rp.name}/${filePath}`,
                    suggestion: 'ตรวจสอบว่าลืมเพิ่มใน item_texture.json หรือลบไฟล์ที่ไม่ใช้ออก'
                });
            }
        }
    }

    // ========================================
    // 6. Orphan Attachables (no matching BP item)
    // ========================================
    function checkOrphanAttachables(rp, bp, issues) {
        const bpItemIds = new Set();
        for (const [path, content] of bp.files) {
            if (!path.match(/^items\/.*\.json$/i)) continue;
            try {
                const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                const json = JSON.parse(text);
                const id = json['minecraft:item']?.description?.identifier;
                if (id) bpItemIds.add(id);
            } catch (e) { /* skip */ }
        }

        for (const [path, content] of rp.files) {
            if (!path.match(/^attachables\/.*\.json$/i)) continue;
            try {
                const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                const json = JSON.parse(text);
                const id = json['minecraft:attachable']?.description?.identifier;
                if (!id) continue;

                if (!bpItemIds.has(id)) {
                    issues.push({
                        severity: 'warning',
                        category: 'ไม่ได้ใช้งาน',
                        message: `Attachable "${id}" ไม่มี item คู่ใน BP — อาจเป็นของเหลือที่ไม่ได้ใช้`,
                        file: `${rp.name}/${path}`,
                        suggestion: 'ตรวจสอบว่าลืมสร้าง item ใน BP หรือ attachable นี้ไม่จำเป็นแล้ว'
                    });
                }
            } catch (e) { /* skip */ }
        }
    }

    // ========================================
    // 7. Items not referenced in scripts/functions
    // ========================================
    function checkUnreferencedItems(bp, issues) {
        const items = [];
        for (const [path, content] of bp.files) {
            if (!path.match(/^items\/.*\.json$/i)) continue;
            try {
                const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                const json = JSON.parse(text);
                const id = json['minecraft:item']?.description?.identifier;
                const menuCat = json['minecraft:item']?.description?.menu_category?.category;
                if (id) items.push({ id, menuNone: menuCat === 'none', path });
            } catch (e) { /* skip */ }
        }

        if (items.length === 0) return;

        // Gather all text from scripts and mcfunctions
        let allScriptText = '';
        for (const [path, content] of bp.files) {
            if (path.endsWith('.js') || path.endsWith('.mcfunction')) {
                const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                allScriptText += text + '\n';
            }
        }

        if (!allScriptText) return;

        for (const item of items) {
            // Skip icon/utility items (menu_category: none) — they're catalog-only
            if (item.menuNone) continue;

            if (!allScriptText.includes(item.id)) {
                issues.push({
                    severity: 'warning',
                    category: 'ไม่ได้ใช้งาน',
                    message: `Item "${item.id}" ไม่ถูกอ้างอิงใน script หรือ mcfunction ใดเลย`,
                    file: `${bp.name}/${item.path}`,
                    suggestion: 'ตรวจสอบว่า item นี้ถูกใช้ที่อื่นหรือเป็นของเหลือที่ไม่ต้องการแล้ว'
                });
            }
        }
    }

    // ========================================
    // Helpers
    // ========================================
    function findMatchingBP(rp, bpPacks) {
        if (bpPacks.length === 1) return bpPacks[0];
        const rpBase = rp.name.replace(/_?RP$/i, '').toLowerCase();
        return bpPacks.find(bp => {
            const bpBase = bp.name.replace(/_?BP$/i, '').toLowerCase();
            return bpBase === rpBase;
        }) || bpPacks[0] || null;
    }

    return { validate };
})();
