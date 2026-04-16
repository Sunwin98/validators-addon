/**
 * Animation Validator — ตรวจสอบ animation references ใน attachable กับไฟล์ animation จริง
 */
const AnimationValidator = (() => {
    /**
     * @param {Array<PackInfo>} packs
     * @returns {Array}
     */
    function validate(packs) {
        const issues = [];
        const rpPacks = packs.filter(p => p.type === 'RP');

        for (const rp of rpPacks) {
            // Collect all available animation identifiers
            const availableAnimations = collectAnimations(rp);

            // Check attachable animation references
            for (const [path, content] of rp.files) {
                if (!path.match(/^attachables\/.*\.json$/i)) continue;

                try {
                    const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                    const json = JSON.parse(text);
                    const desc = json['minecraft:attachable']?.description;
                    if (!desc) continue;

                    const identifier = desc.identifier || path;

                    // Check animations map
                    if (desc.animations) {
                        for (const [animKey, animRef] of Object.entries(desc.animations)) {
                            if (typeof animRef !== 'string') continue;
                            // Skip controller references (render controllers, etc.)
                            if (animRef.startsWith('controller.')) continue;

                            if (!availableAnimations.has(animRef)) {
                                issues.push({
                                    severity: 'error',
                                    category: 'Animation',
                                    message: `Attachable "${identifier}" อ้างถึง animation "${animRef}" แต่ไม่พบในไฟล์ animation`,
                                    file: `${rp.name}/${path}`,
                                    suggestion: `ตรวจสอบว่ามีไฟล์ .animation.json ที่มี animation id "${animRef}" อยู่ใน animations/`
                                });
                            }
                        }
                    }

                    // Check animate array for references
                    if (desc.animate && Array.isArray(desc.animate)) {
                        for (const animEntry of desc.animate) {
                            const animKey = typeof animEntry === 'string'
                                ? animEntry
                                : (typeof animEntry === 'object' ? Object.keys(animEntry)[0] : null);

                            if (animKey && desc.animations && !desc.animations[animKey]) {
                                issues.push({
                                    severity: 'error',
                                    category: 'Animation',
                                    message: `Attachable "${identifier}" ใช้ animate "${animKey}" แต่ไม่ได้ประกาศใน animations map`,
                                    file: `${rp.name}/${path}`,
                                    suggestion: `เพิ่ม "${animKey}" ใน animations map ของ attachable`
                                });
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

    function collectAnimations(rp) {
        const animations = new Set();

        for (const [path, content] of rp.files) {
            if (!path.match(/\.animation\.json$/i) && !path.match(/^animations\/.*\.json$/i)) continue;

            try {
                const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                const json = JSON.parse(text);

                if (json.animations) {
                    for (const animId of Object.keys(json.animations)) {
                        animations.add(animId);
                    }
                }
            } catch (e) {
                // ignore
            }
        }

        return animations;
    }

    return { validate };
})();
