/**
 * Editor Manager — Monaco-based file viewer/editor with lightweight tab support
 */
const EditorManager = (() => {
    const state = {
        initialized: false,
        editor: null,
        tabs: [],
        activePath: null,
        monacoReady: null,
        fileResolver: null,
        onActiveFileChange: null,
        onFileSave: null,
        previewUrls: new Set(),
        elements: null,
        shortcutsBound: false
    };

    function init(options = {}) {
        state.fileResolver = options.fileResolver || null;
        state.onActiveFileChange = options.onActiveFileChange || null;
        state.onFileSave = options.onFileSave || null;
        state.elements = {
            tabs: document.getElementById('editor-tabs'),
            panel: document.getElementById('editor-panel'),
            container: document.getElementById('editor-container'),
            empty: document.getElementById('editor-empty'),
            preview: document.getElementById('editor-preview'),
            saveButton: document.getElementById('editor-save-button')
        };

        if (!state.monacoReady) {
            state.monacoReady = loadMonaco().then(createEditor).catch(() => {
                state.monacoReady = Promise.resolve(false);
                return false;
            });
        }

        bindTabEvents();
        bindEditorActions();
        state.initialized = true;
        renderTabs();
        return state.monacoReady;
    }

    async function openFile(fileInfo, options = {}) {
        if (!fileInfo) return;
        if (!state.initialized) {
            init({ fileResolver: state.fileResolver, onActiveFileChange: state.onActiveFileChange });
        }

        const monacoAvailable = await state.monacoReady;
        const existing = state.tabs.find(tab => tab.path === fileInfo.path);

        if (existing) {
            state.activePath = existing.path;
            showTab(existing, monacoAvailable, options);
            return;
        }

        const tab = {
            path: fileInfo.path,
            name: fileInfo.name || fileInfo.path.split('/').pop(),
            language: detectLanguage(fileInfo.path),
            originalContent: normalizeTextContent(fileInfo.content),
            binaryContent: fileInfo.content,
            previewType: fileInfo.previewType || 'code',
            model: null,
            modified: false,
            fallbackValue: normalizeTextContent(fileInfo.content),
            viewState: null
        };

        if (tab.previewType !== 'image' && monacoAvailable && window.monaco) {
            tab.model = monaco.editor.createModel(tab.originalContent, tab.language);
            tab.model.onDidChangeContent(() => {
                tab.modified = tab.model.getValue() !== tab.originalContent;
                renderTabs();
                updateSaveButtonState();
            });
        }

        state.tabs.push(tab);
        state.activePath = tab.path;
        showTab(tab, monacoAvailable, options);
    }

    function closeTab(path) {
        const index = state.tabs.findIndex(tab => tab.path === path);
        if (index === -1) return;

        const [tab] = state.tabs.splice(index, 1);
        if (tab.model) {
            tab.model.dispose();
        }

        if (state.activePath === path) {
            const nextTab = state.tabs[index] || state.tabs[index - 1] || null;
            state.activePath = nextTab ? nextTab.path : null;

            if (nextTab) {
                const monacoAvailable = Boolean(window.monaco && state.editor);
                showTab(nextTab, monacoAvailable, {});
            } else {
                showEmptyState();
            }
        }

        renderTabs();
        updateSaveButtonState();
    }

    function focusFile(path, options = {}) {
        const tab = state.tabs.find(item => item.path === path);
        if (!tab) return;
        state.activePath = path;
        showTab(tab, Boolean(window.monaco && state.editor), options);
    }

    function getModifiedFiles() {
        const modified = new Map();
        for (const tab of state.tabs) {
            if (!tab.modified) continue;
            modified.set(tab.path, tab.model ? tab.model.getValue() : tab.fallbackValue);
        }
        return modified;
    }

    function getActivePath() {
        return state.activePath;
    }

    async function saveActiveFile() {
        const activeTab = getActiveTab();
        if (!activeTab || activeTab.previewType === 'image' || !activeTab.modified) {
            return false;
        }

        const content = activeTab.model ? activeTab.model.getValue() : activeTab.fallbackValue;

        if (typeof state.onFileSave === 'function') {
            await state.onFileSave(activeTab.path, content, activeTab);
        }

        activeTab.originalContent = content;
        activeTab.fallbackValue = content;
        activeTab.modified = false;

        renderTabs();
        updateSaveButtonState();
        return true;
    }

    function showTab(tab, monacoAvailable, options = {}) {
        renderTabs();
        clearPreviewUrls();

        if (!state.elements) return;
        state.elements.empty.classList.add('hidden');
        state.elements.preview.classList.add('hidden');

        if (tab.previewType === 'image') {
            openImagePreview(tab);
            renderTabs();
            return;
        }

        if (monacoAvailable && state.editor && tab.model) {
            state.elements.container.classList.remove('hidden');

            const currentModel = state.editor.getModel();
            if (currentModel && currentModel !== tab.model) {
                const currentTab = state.tabs.find(item => item.model === currentModel);
                if (currentTab) {
                    currentTab.viewState = state.editor.saveViewState();
                }
            }

            state.editor.setModel(tab.model);
            state.editor.updateOptions({ readOnly: false });

            if (tab.viewState) {
                state.editor.restoreViewState(tab.viewState);
            }

            if (options.line) {
                revealLine(options.line, options.column || 1);
            }

            state.editor.focus();
        } else {
            renderFallbackEditor(tab);
            if (options.line) {
                highlightFallbackLine(options.line);
            }
        }

        if (typeof state.onActiveFileChange === 'function') {
            state.onActiveFileChange(tab.path);
        }

        updateSaveButtonState();
    }

    function renderFallbackEditor(tab) {
        state.elements.container.classList.remove('hidden');
        state.elements.container.innerHTML = '';

        const textarea = document.createElement('textarea');
        textarea.className = 'editor-fallback';
        textarea.spellcheck = false;
        textarea.value = tab.model ? tab.model.getValue() : tab.fallbackValue;

        textarea.addEventListener('input', () => {
            tab.fallbackValue = textarea.value;
            tab.modified = textarea.value !== tab.originalContent;
            renderTabs();
        });

        state.elements.container.appendChild(textarea);
    }

    function highlightFallbackLine(line) {
        const textarea = state.elements.container.querySelector('.editor-fallback');
        if (!textarea || line < 1) return;

        const lines = textarea.value.split('\n');
        let start = 0;
        for (let index = 0; index < line - 1 && index < lines.length; index++) {
            start += lines[index].length + 1;
        }
        const end = start + (lines[line - 1] || '').length;
        textarea.focus();
        textarea.setSelectionRange(start, end);
    }

    function openImagePreview(fileInfo) {
        if (!state.elements) return;
        state.activePath = fileInfo.path;
        renderTabs();
        state.elements.empty.classList.add('hidden');
        state.elements.container.classList.add('hidden');
        state.elements.preview.classList.remove('hidden');

        clearPreviewUrls();

        const blob = new Blob([fileInfo.binaryContent || fileInfo.content], { type: detectMimeType(fileInfo.path) });
        const url = URL.createObjectURL(blob);
        state.previewUrls.add(url);

        state.elements.preview.innerHTML = `
            <div class="image-preview-shell">
                <div class="image-preview-meta">
                    <div class="image-preview-name">${escapeHtml(fileInfo.name || fileInfo.path.split('/').pop())}</div>
                    <div class="image-preview-path">${escapeHtml(fileInfo.path)}</div>
                </div>
                <div class="image-preview-stage">
                    <img src="${url}" alt="${escapeHtml(fileInfo.name || fileInfo.path.split('/').pop())}" class="image-preview-media">
                </div>
            </div>
        `;

        if (typeof state.onActiveFileChange === 'function') {
            state.onActiveFileChange(fileInfo.path);
        }
    }

    function renderTabs() {
        if (!state.elements || !state.elements.tabs) return;

        if (state.tabs.length === 0) {
            state.elements.tabs.innerHTML = '<div class="editor-tabs-empty">NO OPEN EDITORS</div>';
            updateSaveButtonState();
            return;
        }

        state.elements.tabs.innerHTML = state.tabs.map(tab => `
            <button class="editor-tab${tab.path === state.activePath ? ' active' : ''}" type="button" data-path="${escapeAttribute(tab.path)}">
                <span class="editor-tab-name">${escapeHtml(tab.name)}</span>
                <span class="editor-tab-state">${tab.modified ? '●' : ''}</span>
                <span class="editor-tab-close" data-close-path="${escapeAttribute(tab.path)}">×</span>
            </button>
        `).join('');

        updateSaveButtonState();
    }

    function bindTabEvents() {
        if (!state.elements || state.elements.tabs.dataset.bound === 'true') return;

        state.elements.tabs.addEventListener('click', async (event) => {
            const closeButton = event.target.closest('[data-close-path]');
            if (closeButton) {
                closeTab(closeButton.dataset.closePath);
                return;
            }

            const tabButton = event.target.closest('[data-path]');
            if (!tabButton) return;
            const path = tabButton.dataset.path;
            const existingTab = state.tabs.find(tab => tab.path === path);
            if (existingTab) {
                focusFile(path);
                return;
            }

            if (typeof state.fileResolver === 'function') {
                const fileInfo = state.fileResolver(path);
                if (fileInfo) {
                    await openFile(fileInfo);
                }
            }
        });

        state.elements.tabs.dataset.bound = 'true';
    }

    function bindEditorActions() {
        if (state.elements?.saveButton && state.elements.saveButton.dataset.bound !== 'true') {
            state.elements.saveButton.addEventListener('click', () => {
                void handleSaveRequest();
            });
            state.elements.saveButton.dataset.bound = 'true';
        }

        if (!state.shortcutsBound) {
            document.addEventListener('keydown', handleEditorShortcuts, true);
            state.shortcutsBound = true;
        }
    }

    async function handleSaveRequest() {
        const saveButton = state.elements?.saveButton;
        if (!saveButton || saveButton.disabled) {
            return false;
        }

        saveButton.classList.add('is-saving');

        try {
            return await saveActiveFile();
        } catch (error) {
            console.error('Save failed:', error);
            alert(`บันทึกไฟล์ไม่สำเร็จ: ${error.message}`);
            return false;
        } finally {
            saveButton.classList.remove('is-saving');
            updateSaveButtonState();
        }
    }

    function handleEditorShortcuts(event) {
        if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
            const resultsSection = document.getElementById('results-section');
            if (resultsSection?.classList.contains('hidden')) {
                return;
            }

            event.preventDefault();
            void handleSaveRequest();
        }
    }

    function showEmptyState() {
        clearPreviewUrls();
        if (!state.elements) return;
        state.elements.empty.classList.remove('hidden');
        state.elements.preview.classList.add('hidden');
        state.elements.container.classList.add('hidden');
        state.elements.container.innerHTML = '';

        if (state.editor) {
            const currentModel = state.editor.getModel();
            if (currentModel) {
                state.editor.setModel(null);
            }
        }

        if (typeof state.onActiveFileChange === 'function') {
            state.onActiveFileChange(null);
        }

        updateSaveButtonState();
    }

    function reset() {
        clearPreviewUrls();

        for (const tab of state.tabs) {
            if (tab.model) {
                tab.model.dispose();
            }
        }

        state.tabs = [];
        state.activePath = null;

        if (state.elements) {
            state.elements.tabs.innerHTML = '';
            state.elements.container.innerHTML = '';
            state.elements.preview.innerHTML = '';
        }

        showEmptyState();
        renderTabs();
        updateSaveButtonState();
    }

    function revealLine(lineNumber, column) {
        if (!state.editor) return;
        state.editor.revealLineInCenter(lineNumber);
        state.editor.setPosition({ lineNumber, column });
        state.editor.focus();
    }

    function clearPreviewUrls() {
        for (const url of state.previewUrls) {
            URL.revokeObjectURL(url);
        }
        state.previewUrls.clear();
    }

    function createEditor(monacoAvailable) {
        if (!monacoAvailable || !state.elements || !window.monaco) return false;
        if (state.editor) return true;

        state.editor = monaco.editor.create(state.elements.container, {
            value: '',
            language: 'plaintext',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: true },
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 13,
            lineHeight: 20,
            tabSize: 4,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            renderWhitespace: 'selection',
            wordWrap: 'off'
        });

        state.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            void handleSaveRequest();
        });

        return true;
    }

    function updateSaveButtonState() {
        const saveButton = state.elements?.saveButton;
        if (!saveButton) return;

        const activeTab = getActiveTab();
        const canSave = Boolean(activeTab && activeTab.previewType !== 'image' && activeTab.modified);

        saveButton.disabled = !canSave;
        saveButton.classList.toggle('is-active', canSave);
        saveButton.setAttribute('aria-disabled', String(!canSave));
    }

    function getActiveTab() {
        return state.tabs.find(tab => tab.path === state.activePath) || null;
    }

    function loadMonaco() {
        if (window.monaco && window.monaco.editor) {
            return Promise.resolve(true);
        }

        return new Promise(resolve => {
            if (typeof window.require !== 'function') {
                resolve(false);
                return;
            }

            window.require.config({
                paths: {
                    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs'
                }
            });

            window.require(['vs/editor/editor.main'], () => resolve(true), () => resolve(false));
        });
    }

    function normalizeTextContent(content) {
        if (typeof content === 'string') return content;
        if (content instanceof Uint8Array) {
            return new TextDecoder().decode(content);
        }
        return '';
    }

    function detectLanguage(path) {
        const normalized = path.toLowerCase();
        if (normalized.endsWith('.json')) return 'json';
        if (normalized.endsWith('.js')) return 'javascript';
        if (normalized.endsWith('.ts')) return 'typescript';
        if (normalized.endsWith('.html')) return 'html';
        if (normalized.endsWith('.css')) return 'css';
        return 'plaintext';
    }

    function detectMimeType(path) {
        const normalized = path.toLowerCase();
        if (normalized.endsWith('.png')) return 'image/png';
        if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
        if (normalized.endsWith('.gif')) return 'image/gif';
        if (normalized.endsWith('.webp')) return 'image/webp';
        if (normalized.endsWith('.bmp')) return 'image/bmp';
        return 'application/octet-stream';
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
        init,
        openFile,
        closeTab,
        focusFile,
        getModifiedFiles,
        getActivePath,
        saveActiveFile,
        reset
    };
})();