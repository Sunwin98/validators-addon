/**
 * Model Validator — ตรวจสอบ geometry reference ใน attachable กับ .geo.json จริง
 */
const ModelValidator = (() => {
    /**
     * @param {Array<PackInfo>} packs
     * @returns {Array}
     */
    function validate(packs) {
        const issues = [];
        const rpPacks = packs.filter(p => p.type === 'RP');

        for (const rp of rpPacks) {
            // Collect all available geometry identifiers from .geo.json files
            const availableGeometries = collectGeometries(rp);

            // Check attachable geometry references
            for (const [path, content] of rp.files) {
                if (!path.match(/^attachables\/.*\.json$/i)) continue;

                try {
                    const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                    const json = JSON.parse(text);
                    const desc = json['minecraft:attachable']?.description;
                    if (!desc || !desc.geometry) continue;

                    const identifier = desc.identifier || path;

                    for (const [geoKey, geoRef] of Object.entries(desc.geometry)) {
                        if (typeof geoRef !== 'string') continue;

                        // Check if the geometry identifier exists
                        if (!availableGeometries.has(geoRef)) {
                            issues.push({
                                severity: 'error',
                                category: 'Model/Geometry',
                                message: `Attachable "${identifier}" อ้างถึง geometry "${geoRef}" แต่ไม่พบใน models/entity/`,
                                file: `${rp.name}/${path}`,
                                suggestion: `ตรวจสอบว่ามีไฟล์ .geo.json ที่มี identifier "${geoRef}" อยู่ใน models/entity/`
                            });
                        }
                    }
                } catch (e) {
                    // ignore JSON errors
                }
            }
        }

        return issues;
    }

    function collectGeometries(rp) {
        const geometries = new Set();

        for (const [path, content] of rp.files) {
            if (!path.match(/\.geo\.json$/i) && !path.match(/^models\/.*\.json$/i)) continue;

            try {
                const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                const json = JSON.parse(text);

                // Format: minecraft:geometry array
                if (json['minecraft:geometry']) {
                    for (const geo of json['minecraft:geometry']) {
                        if (geo.description?.identifier) {
                            geometries.add(geo.description.identifier);
                        }
                    }
                }

                // Legacy format
                if (json.format_version && json['minecraft:geometry']) {
                    // Already handled above
                } else {
                    // Try old format: keys starting with geometry.
                    for (const key of Object.keys(json)) {
                        if (key.startsWith('geometry.')) {
                            geometries.add(key);
                        }
                    }
                }
            } catch (e) {
                // ignore
            }
        }

        return geometries;
    }

    return { validate };
})();
