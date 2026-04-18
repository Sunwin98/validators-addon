/**
 * App — Main orchestrator
 * จัดการ Drag & Drop, เรียก Unzipper, เรียก Validators, แสดงผลด้วย UIRenderer
 */
(() => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const dropSection = document.getElementById('drop-section');
    const progressSection = document.getElementById('progress-section');
    const resultsSection = document.getElementById('results-section');

    const ALLOWED_EXTENSIONS = ['.mcaddon', '.mcpack', '.zip'];

    // ===== Drag & Drop Events =====
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFiles(files);
        }
    });

    // Click to browse
    dropZone.addEventListener('click', (e) => {
        // Don't trigger if clicking the button directly
        if (e.target.closest('.btn-browse')) return;
        fileInput.click();
    });

    // Keyboard access for drop zone (Enter / Space)
    dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });

    const themeToggle = document.getElementById('theme-toggle');

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('addon_theme', nextTheme);
        });
    }

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
            // Reset input so same file can be selected again
            fileInput.value = '';
        }
    });

    // ===== File Handler =====
    async function handleFiles(fileList) {
        const validFiles = [];

        for (const file of fileList) {
            const ext = '.' + file.name.split('.').pop().toLowerCase();
            if (ALLOWED_EXTENSIONS.includes(ext)) {
                validFiles.push(file);
            }
        }

        if (validFiles.length === 0) {
            alert('กรุณาเลือกไฟล์ .mcaddon, .mcpack หรือ .zip');
            return;
        }

        // Process all files
        const allPacks = [];
        const allIssues = [];

        dropSection.classList.add('hidden');
        progressSection.classList.remove('hidden');

        try {
            for (const file of validFiles) {
                UIRenderer.showProgress(`กำลังแตกไฟล์ ${file.name}...`, 10, `ขนาด: ${formatFileSize(file.size)}`);

                // 1. Extract
                const packs = await Unzipper.extract(file, (text, pct) => {
                    UIRenderer.showProgress(text, pct, file.name);
                });

                allPacks.push(...packs);
            }

            // 2. Validate
            UIRenderer.showProgress('กำลังตรวจสอบ...', 85, `ตรวจสอบ ${allPacks.length} แพ็ก`);
            await runValidation(allPacks, allIssues);

            // 3. Build file tree
            UIRenderer.showProgress('กำลังสร้างรายงาน...', 95);
            const fileTree = Unzipper.buildFileTree(allPacks);

            // 4. Render results
            UIRenderer.hideProgress();
            progressSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');

            window.__addonInspectorState = {
                packs: allPacks,
                issues: allIssues,
                fileTree
            };

            UIRenderer.render(allIssues, allPacks, fileTree);

        } catch (error) {
            console.error('Validation error:', error);
            UIRenderer.hideProgress();
            progressSection.classList.add('hidden');
            dropSection.classList.remove('hidden');
            alert(`เกิดข้อผิดพลาด: ${error.message}\n\nอาจเป็นเพราะไฟล์ไม่ใช่ zip ที่ถูกต้อง`);
        }
    }

    // ===== Validation Runner =====
    async function runValidation(packs, issues) {
        // Allow UI to update
        await tick();

        // 1. JSON Syntax Check (all packs)
        for (const pack of packs) {
            const jsonIssues = JsonSyntaxValidator.validate(pack.files, pack.name);
            issues.push(...jsonIssues);
        }
        await tick();

        // 2. Manifest Check
        for (const pack of packs) {
            const manifestIssues = ManifestValidator.validate(pack, packs);
            issues.push(...manifestIssues);
        }
        await tick();

        // 3. Item Cross-Reference (needs both BP + RP)
        const itemIssues = ItemValidator.validate(packs);
        issues.push(...itemIssues);
        await tick();

        // 4. Texture Path Check (RP only)
        const textureIssues = TextureValidator.validate(packs);
        issues.push(...textureIssues);
        await tick();

        // 5. Model/Geometry Check (RP only)
        const modelIssues = ModelValidator.validate(packs);
        issues.push(...modelIssues);
        await tick();

        // 6. Animation Check (RP only)
        const animationIssues = AnimationValidator.validate(packs);
        issues.push(...animationIssues);
        await tick();

        // 7. Function Check (BP only)
        for (const pack of packs) {
            if (pack.type === 'BP') {
                const funcIssues = FunctionValidator.validate(pack);
                issues.push(...funcIssues);
            }
        }
        await tick();

        // 8. Script Check (BP only)
        for (const pack of packs) {
            if (pack.type === 'BP') {
                const scriptIssues = ScriptValidator.validate(pack);
                issues.push(...scriptIssues);
            }
        }
        await tick();

        // 9. Language File Check (BP + RP)
        const langIssues = LangValidator.validate(packs);
        issues.push(...langIssues);
        await tick();

        // 10. Unused Assets Check
        const unusedIssues = UnusedValidator.validate(packs);
        issues.push(...unusedIssues);
    }

    function tick() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

})();
