/**
 * Manifest Validator — ตรวจสอบ manifest.json ของแต่ละ pack
 */
const ManifestValidator = (() => {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    /**
     * @param {import('../unzipper').PackInfo} pack
     * @param {Array<import('../unzipper').PackInfo>} allPacks - ทุก pack สำหรับเช็ค UUID ซ้ำ
     * @returns {Array}
     */
    function validate(pack, allPacks) {
        const issues = [];
        const { files, manifest, name, type } = pack;

        // 1. Check manifest exists
        const hasManifest = files.has('manifest.json') ||
            [...files.keys()].some(p => p.endsWith('manifest.json'));

        if (!hasManifest) {
            issues.push({
                severity: 'error',
                category: 'Manifest',
                message: 'ไม่พบไฟล์ manifest.json ในแพ็ก',
                file: name,
                suggestion: 'ทุก Behavior Pack และ Resource Pack ต้องมีไฟล์ manifest.json ที่ root'
            });
            return issues;
        }

        // 2. Check manifest parsed successfully
        if (!manifest) {
            issues.push({
                severity: 'error',
                category: 'Manifest',
                message: 'ไม่สามารถอ่าน manifest.json ได้ (อาจเป็นปัญหา JSON syntax)',
                file: `${name}/manifest.json`,
                suggestion: 'ตรวจสอบโครงสร้าง JSON ของ manifest.json'
            });
            return issues;
        }

        // 3. Check format_version
        if (!manifest.format_version) {
            issues.push({
                severity: 'warning',
                category: 'Manifest',
                message: 'ไม่มี format_version ใน manifest.json',
                file: `${name}/manifest.json`,
                suggestion: 'แนะนำให้ใส่ "format_version": 2'
            });
        }

        // 4. Check header
        if (!manifest.header) {
            issues.push({
                severity: 'error',
                category: 'Manifest',
                message: 'ไม่มี header ใน manifest.json',
                file: `${name}/manifest.json`,
                suggestion: 'ต้องมี header ที่มี name, description, uuid, version, min_engine_version'
            });
            return issues;
        }

        const header = manifest.header;

        // Check required fields
        const requiredFields = ['name', 'description', 'uuid', 'version', 'min_engine_version'];
        for (const field of requiredFields) {
            if (!header[field]) {
                issues.push({
                    severity: field === 'uuid' ? 'error' : 'warning',
                    category: 'Manifest',
                    message: `header ขาด field "${field}"`,
                    file: `${name}/manifest.json`,
                    suggestion: `เพิ่ม "${field}" ใน header ของ manifest.json`
                });
            }
        }

        // 5. Validate UUID format
        if (header.uuid && !UUID_REGEX.test(header.uuid)) {
            issues.push({
                severity: 'error',
                category: 'Manifest',
                message: `UUID ใน header ไม่ถูกต้อง: "${header.uuid}"`,
                file: `${name}/manifest.json`,
                suggestion: 'UUID ต้องเป็นรูปแบบ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
            });
        }

        // 6. Check modules
        if (!manifest.modules || !Array.isArray(manifest.modules) || manifest.modules.length === 0) {
            issues.push({
                severity: 'error',
                category: 'Manifest',
                message: 'ไม่มี modules ใน manifest.json หรือ modules ว่างเปล่า',
                file: `${name}/manifest.json`,
                suggestion: 'ต้องมี modules อย่างน้อย 1 ตัว (type: "data", "script", หรือ "resources")'
            });
        } else {
            // Check each module UUID
            for (let i = 0; i < manifest.modules.length; i++) {
                const mod = manifest.modules[i];
                if (mod.uuid && !UUID_REGEX.test(mod.uuid)) {
                    issues.push({
                        severity: 'error',
                        category: 'Manifest',
                        message: `UUID ของ module[${i}] ไม่ถูกต้อง: "${mod.uuid}"`,
                        file: `${name}/manifest.json`,
                        suggestion: 'UUID ต้องเป็นรูปแบบ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
                    });
                }

                if (!mod.type) {
                    issues.push({
                        severity: 'error',
                        category: 'Manifest',
                        message: `module[${i}] ไม่มี type`,
                        file: `${name}/manifest.json`,
                        suggestion: 'module ต้องมี type เป็น "data", "script", หรือ "resources"'
                    });
                }
            }
        }

        // 7. Check UUID uniqueness across all packs
        if (header.uuid && allPacks) {
            const allUUIDs = collectAllUUIDs(allPacks);
            const duplicates = allUUIDs.filter(u => u.uuid === header.uuid && u.pack !== name);
            if (duplicates.length > 0) {
                issues.push({
                    severity: 'error',
                    category: 'Manifest',
                    message: `UUID header ซ้ำกับแพ็ก "${duplicates[0].pack}"`,
                    file: `${name}/manifest.json`,
                    suggestion: 'ทุก pack ต้องมี UUID ไม่ซ้ำกัน สร้าง UUID ใหม่ได้ที่ uuidgenerator.net'
                });
            }
        }

        // 8. Check script entry if script module exists
        const scriptModule = manifest.modules?.find(m => m.type === 'script');
        if (scriptModule && scriptModule.entry) {
            const entryPath = scriptModule.entry;
            if (!files.has(entryPath)) {
                issues.push({
                    severity: 'error',
                    category: 'Manifest',
                    message: `ไฟล์ script entry "${entryPath}" ไม่มีอยู่ในแพ็ก`,
                    file: `${name}/manifest.json`,
                    suggestion: `ตรวจสอบว่าไฟล์ "${entryPath}" มีอยู่จริงและ path ถูกต้อง`
                });
            }
        }

        return issues;
    }

    function collectAllUUIDs(packs) {
        const uuids = [];
        for (const pack of packs) {
            if (pack.manifest?.header?.uuid) {
                uuids.push({ uuid: pack.manifest.header.uuid, pack: pack.name, location: 'header' });
            }
            if (pack.manifest?.modules) {
                for (const mod of pack.manifest.modules) {
                    if (mod.uuid) {
                        uuids.push({ uuid: mod.uuid, pack: pack.name, location: 'module' });
                    }
                }
            }
        }
        return uuids;
    }

    return { validate };
})();
