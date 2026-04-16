/**
 * Language Validator — ตรวจสอบว่า item ทุกตัวมี lang entry ใน en_US.lang
 */
const LangValidator = (() => {
    /**
     * @param {Array<PackInfo>} packs
     * @returns {Array}
     */
    function validate(packs) {
        const issues = [];
        const bpPacks = packs.filter(p => p.type === 'BP');
        const rpPacks = packs.filter(p => p.type === 'RP');

        for (const bp of bpPacks) {
            const rp = findMatchingRP(bp, rpPacks);
            if (!rp) continue;

            // Collect item identifiers from BP
            const items = collectItemIdentifiers(bp);
            if (items.length === 0) continue;

            // Read lang file from RP
            const langEntries = readLangFile(rp);

            // Check if lang file exists
            const hasLang = rp.files.has('texts/en_US.lang') ||
                [...rp.files.keys()].some(p => p.match(/texts\/.*\.lang$/i));

            if (!hasLang) {
                issues.push({
                    severity: 'warning',
                    category: 'Language File',
                    message: 'ไม่พบไฟล์ texts/en_US.lang ใน RP — ชื่อ item จะแสดงเป็น identifier ดิบ',
                    file: rp.name,
                    suggestion: 'สร้างไฟล์ texts/en_US.lang และเพิ่ม item name mappings'
                });
                continue;
            }

            // Check each item has a lang entry
            for (const item of items) {
                const expectedKey = `item.${item.identifier}.name`;
                if (!langEntries.has(expectedKey)) {
                    issues.push({
                        severity: 'warning',
                        category: 'Language File',
                        message: `Item "${item.identifier}" ไม่มี lang entry ("${expectedKey}")`,
                        file: `${rp.name}/texts/en_US.lang`,
                        suggestion: `เพิ่ม "${expectedKey}=ชื่อที่ต้องการ" ใน en_US.lang`
                    });
                }
            }
        }

        return issues;
    }

    function collectItemIdentifiers(bp) {
        const items = [];
        for (const [path, content] of bp.files) {
            if (!path.match(/^items\/.*\.json$/i)) continue;
            try {
                const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
                const json = JSON.parse(text);
                const id = json['minecraft:item']?.description?.identifier;
                if (id) items.push({ identifier: id, file: `${bp.name}/${path}` });
            } catch (e) {
                // ignore
            }
        }
        return items;
    }

    function readLangFile(rp) {
        const entries = new Set();
        for (const [path, content] of rp.files) {
            if (!path.match(/texts\/.*\.lang$/i)) continue;

            const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
            const lines = text.split('\n');

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('#') || trimmed === '' || !trimmed.includes('=')) continue;
                const key = trimmed.split('=')[0].trim();
                entries.add(key);
            }
        }
        return entries;
    }

    function findMatchingRP(bp, rpPacks) {
        if (rpPacks.length === 1) return rpPacks[0];
        const bpBase = bp.name.replace(/_?BP$/i, '').toLowerCase();
        return rpPacks.find(rp => {
            const rpBase = rp.name.replace(/_?RP$/i, '').toLowerCase();
            return rpBase === bpBase;
        }) || rpPacks[0] || null;
    }

    return { validate };
})();
