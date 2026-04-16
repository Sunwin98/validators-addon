/**
 * JSON Syntax Validator — ตรวจสอบ syntax ของไฟล์ .json ทุกไฟล์
 */
const JsonSyntaxValidator = (() => {
    /**
     * @param {Map<string, any>} files
     * @param {string} packName
     * @returns {Array<{severity, category, message, file, suggestion}>}
     */
    function validate(files, packName) {
        const issues = [];

        for (const [path, content] of files) {
            if (!path.toLowerCase().endsWith('.json')) continue;

            const text = typeof content === 'string'
                ? content
                : new TextDecoder().decode(content);

            try {
                JSON.parse(text);
            } catch (e) {
                const errorMsg = e.message;
                // Try to extract position info
                const posMatch = errorMsg.match(/position\s+(\d+)/i);
                let lineInfo = '';
                if (posMatch) {
                    const pos = parseInt(posMatch[1]);
                    const lines = text.substring(0, pos).split('\n');
                    const lineNum = lines.length;
                    const colNum = lines[lines.length - 1].length + 1;
                    lineInfo = ` (บรรทัด ${lineNum}, คอลัมน์ ${colNum})`;
                }

                issues.push({
                    severity: 'error',
                    category: 'JSON Syntax',
                    message: `ไฟล์ JSON โครงสร้างพัง${lineInfo}: ${errorMsg}`,
                    file: `${packName}/${path}`,
                    suggestion: 'ตรวจสอบว่าไม่มีลูกน้ำ (comma) ขาดหรือเกิน, วงเล็บปิดครบ, และไม่มี trailing comma'
                });
            }
        }

        return issues;
    }

    return { validate };
})();
