/**
 * UI Renderer — แสดงผล Dashboard, File Tree, Workbench, Issue List
 */
const UIRenderer = (() => {
    let currentFilter = 'all';
    let fileLookup = new Map();

    const SVG_ICONS = {
        error: '<svg class="severity-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--color-error)"/></svg>',
        warning: '<svg class="severity-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--color-warning)"/></svg>',
        pass: '<svg class="severity-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--color-pass)"/></svg>',
        checkmark: '<svg class="severity-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--color-pass)"/><path d="M5 8l2 2 4-4" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        errorBanner: '<svg class="status-banner-svg" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="none" stroke="var(--color-error)" stroke-width="1.5"/><path d="M7 7l6 6M13 7l-6 6" stroke="var(--color-error)" stroke-width="1.5" stroke-linecap="round"/></svg>',
        warningBanner: '<svg class="status-banner-svg" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2l8.66 15H1.34L10 2z" fill="none" stroke="var(--color-warning)" stroke-width="1.5" stroke-linejoin="round"/><line x1="10" y1="8" x2="10" y2="12" stroke="var(--color-warning)" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="14.5" r="0.75" fill="var(--color-warning)"/></svg>',
        passBanner: '<svg class="status-banner-svg" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="none" stroke="var(--color-pass)" stroke-width="1.5"/><path d="M6 10l3 3 5-5" stroke="var(--color-pass)" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        total: '<svg class="severity-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="var(--text-secondary)" stroke-width="1.2"/><line x1="5" y1="5.5" x2="11" y2="5.5" stroke="var(--text-secondary)" stroke-width="1"/><line x1="5" y1="8" x2="11" y2="8" stroke="var(--text-secondary)" stroke-width="1"/><line x1="5" y1="10.5" x2="9" y2="10.5" stroke="var(--text-secondary)" stroke-width="1"/></svg>',
        file: '<svg class="issue-file-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1h5l3 3v7H2V1z" fill="none" stroke="currentColor" stroke-width="1"/><path d="M7 1v3h3" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
        suggestion: '<svg class="issue-suggestion-icon" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="4.5" r="3" fill="none" stroke="currentColor" stroke-width="1"/><line x1="5" y1="8.5" x2="7" y2="8.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><line x1="5" y1="10" x2="7" y2="10" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>'
    };

    function render(issues, packs, fileTree) {
        fileLookup = buildFileLookup(packs);

        renderStatusBanner(issues);
        renderSummaryCards(issues);
        renderFileTree(fileTree, issues);
        renderIssueList(issues);
        renderProblemCount(issues.length);
        setupWorkbench();
        setupFilterButtons();
        setupNewCheckButton();
        openInitialFile(issues);
    }

    function renderStatusBanner(issues) {
        const errors = issues.filter(issue => issue.severity === 'error');
        const warnings = issues.filter(issue => issue.severity === 'warning');

        const container = document.getElementById('results-section');
        let banner = container.querySelector('.status-banner');
        if (banner) banner.remove();

        banner = document.createElement('div');
        banner.className = 'status-banner';

        if (errors.length > 0) {
            banner.classList.add('status-error');
            banner.innerHTML = `
                <span class="status-banner-icon">${SVG_ICONS.errorBanner}</span>
                <span>พบปัญหาร้ายแรง ${errors.length} จุด — Add-on อาจทำงานผิดปกติหรือพังได้</span>
            `;
        } else if (warnings.length > 0) {
            banner.classList.add('status-warning');
            banner.innerHTML = `
                <span class="status-banner-icon">${SVG_ICONS.warningBanner}</span>
                <span>พบข้อควรระวัง ${warnings.length} จุด — แต่ Add-on น่าจะยังทำงานได้</span>
            `;
        } else {
            banner.classList.add('status-pass');
            banner.innerHTML = `
                <span class="status-banner-icon">${SVG_ICONS.passBanner}</span>
                <span>Add-on สมบูรณ์ — ไม่พบปัญหาใดๆ พร้อมใช้งาน!</span>
            `;
        }

        container.insertBefore(banner, container.querySelector('.summary-cards'));
    }

    function renderSummaryCards(issues) {
        const container = document.getElementById('summary-cards');
        const errors = issues.filter(issue => issue.severity === 'error').length;
        const warnings = issues.filter(issue => issue.severity === 'warning').length;
        const total = issues.length;
        const allCategories = [
            'JSON Syntax', 'Manifest', 'Item Cross-Reference', 'Texture Path',
            'Model/Geometry', 'Animation', 'Function', 'Script', 'Language File',
            'ไม่ได้ใช้งาน'
        ];
        const issueCategories = new Set(issues.map(issue => issue.category));
        const passCount = allCategories.filter(category => !issueCategories.has(category)).length;

        container.innerHTML = `
            <div class="summary-card error">
                <span class="summary-icon">${SVG_ICONS.error}</span>
                <div class="summary-info">
                    <div class="summary-count">${errors}</div>
                    <div class="summary-label">Error</div>
                </div>
            </div>
            <div class="summary-card warning">
                <span class="summary-icon">${SVG_ICONS.warning}</span>
                <div class="summary-info">
                    <div class="summary-count">${warnings}</div>
                    <div class="summary-label">Warning</div>
                </div>
            </div>
            <div class="summary-card pass">
                <span class="summary-icon">${SVG_ICONS.pass}</span>
                <div class="summary-info">
                    <div class="summary-count">${passCount}</div>
                    <div class="summary-label">Pass</div>
                </div>
            </div>
            <div class="summary-card total">
                <span class="summary-icon">${SVG_ICONS.total}</span>
                <div class="summary-info">
                    <div class="summary-count">${total}</div>
                    <div class="summary-label">ทั้งหมด</div>
                </div>
            </div>
        `;
    }

    function renderFileTree(tree, issues) {
        const container = document.getElementById('file-tree');
        const issueFileMap = createIssueFileMap(issues);

        let html = '<div class="file-tree-title">Explorer</div>';
        html += '<div class="file-tree-subtitle">ADD-ON FILES</div>';

        for (const pack of tree) {
            html += renderTreeNode(pack, issueFileMap, pack.name);
        }

        container.innerHTML = html;

        container.querySelectorAll('.tree-item.is-folder').forEach(element => {
            element.addEventListener('click', () => {
                const children = element.nextElementSibling;
                if (!children || !children.classList.contains('tree-children')) return;
                children.classList.toggle('collapsed');
                const icon = element.querySelector('.tree-icon');
                icon.textContent = children.classList.contains('collapsed') ? '▸' : '▾';
            });
        });

        container.querySelectorAll('.tree-item.is-file').forEach(element => {
            element.addEventListener('click', async () => {
                await openFileByPath(element.dataset.path);
            });
        });
    }

    function renderTreeNode(node, issueFileMap, packName) {
        if (node.type === 'folder') {
            const hasChildIssues = checkChildIssues(node, issueFileMap, packName);
            const statusClass = hasChildIssues === 'error' ? 'has-error' : hasChildIssues === 'warning' ? 'has-warning' : '';
            const typeLabel = node.packType ? `<span class="tree-pack-badge">${escapeHtml(node.packType)}</span>` : '';

            let html = `<button class="tree-item is-folder ${statusClass}" type="button">
                <span class="tree-icon">▾</span>
                <span class="tree-label">${escapeHtml(node.name)}</span>
                ${typeLabel}
            </button>`;
            html += '<div class="tree-children">';

            if (node.children) {
                for (const child of node.children) {
                    html += renderTreeNode(child, issueFileMap, packName);
                }
            }

            html += '</div>';
            return html;
        }

        const fullPath = node.fullPath || `${packName}/${node.path}`;
        const fileIssues = issueFileMap.get(fullPath) || [];
        const hasError = fileIssues.some(issue => issue.severity === 'error');
        const hasWarning = fileIssues.some(issue => issue.severity === 'warning');
        const statusClass = hasError ? 'has-error' : hasWarning ? 'has-warning' : '';
        const icon = getFileIcon(node.name);

        return `<button class="tree-item is-file ${statusClass}" type="button" data-path="${escapeAttribute(fullPath)}" title="${escapeAttribute(fullPath)}">
            <span class="tree-icon">${hasError ? '●' : hasWarning ? '◐' : icon}</span>
            <span class="tree-label">${escapeHtml(node.name)}</span>
        </button>`;
    }

    function renderIssueList(issues) {
        const container = document.getElementById('issue-list');

        if (issues.length === 0) {
            container.innerHTML = `
                <div class="problems-empty">
                    <svg class="problems-empty-icon" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                        <circle cx="18" cy="18" r="16" stroke="var(--color-pass)" stroke-width="2"/>
                        <path d="M11 18l5 5 9-9" stroke="var(--color-pass)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <div class="problems-empty-text">ไม่พบปัญหาใดๆ<br>Add-on สมบูรณ์ พร้อมใช้งาน</div>
                </div>
            `;
            return;
        }

        const grouped = {};
        for (const issue of issues) {
            if (!grouped[issue.category]) {
                grouped[issue.category] = [];
            }
            grouped[issue.category].push(issue);
        }

        const sortedCategories = Object.entries(grouped).sort((a, b) => {
            const aHasError = a[1].some(issue => issue.severity === 'error');
            const bHasError = b[1].some(issue => issue.severity === 'error');
            if (aHasError && !bHasError) return -1;
            if (!aHasError && bHasError) return 1;
            return 0;
        });

        let html = '';
        const allCategories = [
            'JSON Syntax', 'Manifest', 'Item Cross-Reference', 'Texture Path',
            'Model/Geometry', 'Animation', 'Function', 'Script', 'Language File'
        ];

        for (const [category, categoryIssues] of sortedCategories) {
            const worstSeverity = categoryIssues.some(issue => issue.severity === 'error') ? 'error' : 'warning';
            const icon = worstSeverity === 'error' ? SVG_ICONS.error : SVG_ICONS.warning;

            html += `
                <div class="issue-category ${worstSeverity} expanded" data-severity="${worstSeverity}">
                    <div class="issue-category-header">
                        <div class="issue-category-title">
                            <span>${icon}</span>
                            <span>${escapeHtml(category)}</span>
                        </div>
                        <div class="issue-category-meta">
                            <span class="issue-category-count">${categoryIssues.length}</span>
                            <span class="issue-category-chevron">▼</span>
                        </div>
                    </div>
                    <div class="issue-category-body">
                        ${categoryIssues.map(issue => renderIssueItem(issue)).join('')}
                    </div>
                </div>
            `;
        }

        const issueCategories = new Set(issues.map(issue => issue.category));
        const passCategories = allCategories.filter(category => !issueCategories.has(category));
        if (passCategories.length > 0) {
            html += `
                <div class="issue-category pass" data-severity="pass">
                    <div class="issue-category-header">
                        <div class="issue-category-title">
                            <span>${SVG_ICONS.pass}</span>
                            <span>ผ่านการตรวจสอบ</span>
                        </div>
                        <div class="issue-category-meta">
                            <span class="issue-category-count">${passCategories.length}</span>
                            <span class="issue-category-chevron">▼</span>
                        </div>
                    </div>
                    <div class="issue-category-body">
                        ${passCategories.map(category => `
                            <div class="issue-item">
                                <span class="issue-severity">${SVG_ICONS.checkmark}</span>
                                <div class="issue-content">
                                    <div class="issue-message">${escapeHtml(category)} — ผ่าน</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        container.querySelectorAll('.issue-category-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('expanded');
            });
        });

        container.querySelectorAll('[data-issue-file]').forEach(button => {
            button.addEventListener('click', async event => {
                event.stopPropagation();
                await openFileByPath(button.dataset.issueFile, {
                    line: Number(button.dataset.issueLine) || undefined,
                    column: Number(button.dataset.issueColumn) || undefined
                });
            });
        });
    }

    function renderIssueItem(issue) {
        const icon = issue.severity === 'error' ? SVG_ICONS.error : SVG_ICONS.warning;
        return `
            <div class="issue-item" data-severity="${issue.severity}">
                <span class="issue-severity">${icon}</span>
                <div class="issue-content">
                    <div class="issue-message">${escapeHtml(issue.message)}</div>
                    ${issue.file ? `<button class="issue-file" type="button" data-issue-file="${escapeAttribute(issue.file)}" data-issue-line="${issue.line || ''}" data-issue-column="${issue.column || ''}">${SVG_ICONS.file} ${escapeHtml(issue.file)}</button>` : ''}
                    ${issue.suggestion ? `<div class="issue-suggestion">${SVG_ICONS.suggestion} ${escapeHtml(issue.suggestion)}</div>` : ''}
                </div>
            </div>
        `;
    }

    function setupFilterButtons() {
        document.querySelectorAll('.filter-btn').forEach(button => {
            button.onclick = () => {
                document.querySelectorAll('.filter-btn').forEach(item => item.classList.remove('active'));
                button.classList.add('active');
                currentFilter = button.dataset.filter;
                applyFilter(currentFilter);
            };
        });
    }

    function applyFilter(filter) {
        document.querySelectorAll('.issue-category').forEach(category => {
            const severity = category.dataset.severity;
            category.style.display = filter === 'all' || severity === filter ? '' : 'none';
        });
    }

    function setupNewCheckButton() {
        const newCheckButton = document.getElementById('btn-new-check');
        if (!newCheckButton) return;

        newCheckButton.onclick = () => {
            document.getElementById('results-section').classList.add('hidden');
            document.getElementById('drop-section').classList.remove('hidden');

            document.getElementById('summary-cards').innerHTML = '';
            document.getElementById('file-tree').innerHTML = '';
            document.getElementById('issue-list').innerHTML = '';
            document.getElementById('editor-tabs').innerHTML = '';
            document.getElementById('editor-container').innerHTML = '';
            document.getElementById('editor-preview').innerHTML = '';
            document.getElementById('editor-empty').classList.remove('hidden');
            document.getElementById('editor-container').classList.add('hidden');
            document.getElementById('editor-preview').classList.add('hidden');

            const banner = document.querySelector('.status-banner');
            if (banner) banner.remove();

            currentFilter = 'all';
            fileLookup = new Map();
            window.__addonInspectorState = null;
            EditorManager.reset();

            document.querySelectorAll('.filter-btn').forEach(button => button.classList.remove('active'));
            document.querySelector('.filter-btn[data-filter="all"]')?.classList.add('active');
            document.getElementById('problem-count').textContent = '0';
        };
    }

    function setupWorkbench() {
        EditorManager.init({
            fileResolver: resolveFileByPath,
            onActiveFileChange: highlightActiveFile
        });
    }

    function openInitialFile(issues) {
        const issueWithFile = issues.find(issue => issue.file && fileLookup.has(issue.file));
        if (issueWithFile) {
            openFileByPath(issueWithFile.file, {
                line: issueWithFile.line,
                column: issueWithFile.column
            });
            return;
        }

        const manifestPath = [...fileLookup.keys()].find(path => path.endsWith('/manifest.json'));
        if (manifestPath) {
            openFileByPath(manifestPath);
        }
    }

    async function openFileByPath(path, options = {}) {
        const fileInfo = resolveFileByPath(path);
        if (!fileInfo) return;
        await EditorManager.openFile(fileInfo, options);
        highlightActiveFile(path);
    }

    function resolveFileByPath(path) {
        return fileLookup.get(path) || null;
    }

    function highlightActiveFile(activePath) {
        document.querySelectorAll('.tree-item.is-file').forEach(item => {
            item.classList.toggle('active', item.dataset.path === activePath);
        });
    }

    function renderProblemCount(count) {
        const counter = document.getElementById('problem-count');
        if (counter) {
            counter.textContent = String(count);
        }
    }

    function buildFileLookup(packs) {
        const lookup = new Map();
        for (const pack of packs) {
            for (const [relativePath, content] of pack.files) {
                const fullPath = `${pack.name}/${relativePath}`;
                lookup.set(fullPath, {
                    path: fullPath,
                    name: relativePath.split('/').pop(),
                    content,
                    previewType: isImageFile(relativePath) ? 'image' : 'code'
                });
            }
        }
        return lookup;
    }

    function createIssueFileMap(issues) {
        const issueFileMap = new Map();
        for (const issue of issues) {
            if (!issue.file) continue;
            const existing = issueFileMap.get(issue.file) || [];
            existing.push(issue);
            issueFileMap.set(issue.file, existing);
        }
        return issueFileMap;
    }

    function checkChildIssues(node, issueFileMap, packName) {
        let worst = null;
        if (!node.children) return worst;

        for (const child of node.children) {
            if (child.type === 'file') {
                const fullPath = child.fullPath || `${packName}/${child.path}`;
                const issues = issueFileMap.get(fullPath) || [];
                if (issues.some(issue => issue.severity === 'error')) return 'error';
                if (issues.some(issue => issue.severity === 'warning')) worst = 'warning';
            } else {
                const childResult = checkChildIssues(child, issueFileMap, packName);
                if (childResult === 'error') return 'error';
                if (childResult === 'warning') worst = 'warning';
            }
        }

        return worst;
    }

    function getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const icons = {
            json: '{}',
            js: 'JS',
            ts: 'TS',
            mcfunction: 'Fn',
            lang: 'Ln',
            png: 'IMG',
            tga: 'IMG',
            jpg: 'IMG',
            jpeg: 'IMG',
            txt: 'TXT',
            md: 'MD'
        };
        return icons[ext] || 'FILE';
    }

    function isImageFile(path) {
        return /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(path);
    }

    function showProgress(text, percentage, detail) {
        document.getElementById('progress-section').classList.remove('hidden');
        document.getElementById('progress-text').textContent = text;
        document.getElementById('progress-bar').style.width = `${percentage}%`;
        if (detail) {
            document.getElementById('progress-detail').textContent = detail;
        }
    }

    function hideProgress() {
        document.getElementById('progress-section').classList.add('hidden');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeAttribute(str) {
        return escapeHtml(str).replace(/"/g, '&quot;');
    }

    return {
        render,
        showProgress,
        hideProgress
    };
})();