// _utils/_dataview_scripts/content-metadata-view.js

// 1. SILENT GUARD
if (typeof dv === "undefined") return;

// 2. CONTEXT GUARD
if (!dv.current || !dv.current() || !dv.current().file) {
    dv.paragraph("⚠️ Dataview current file context not ready.");
    return;
}

// ===== CONFIG =====
let SUBJECT = dv.current().file.name;
let EXCLUDE_FOLDERS = ["_utils"];
let EXCLUDE_CURRENT_FILE = false;
let AUTO_COLUMNS = false; // Default: Bundled Metadata
let CUSTOM_COLUMNS = []; // For manual columns

// Input Parsing
if (typeof input !== "undefined") {
    if (Array.isArray(input)) {
        CUSTOM_COLUMNS = input;
    } else if (typeof input === "object" && input !== null) {
        if (input.subject) SUBJECT = input.subject;
        if (input.columns && Array.isArray(input.columns)) CUSTOM_COLUMNS = input.columns;

        if (input.exclude_folders !== undefined) {
            EXCLUDE_FOLDERS = Array.isArray(input.exclude_folders) ? input.exclude_folders : [input.exclude_folders];
        }
        if (input.exclude_current !== undefined) EXCLUDE_CURRENT_FILE = !!input.exclude_current;
        if (input.auto_columns !== undefined) AUTO_COLUMNS = !!input.auto_columns;
    }
}

const HIDE_KEYS = ["stuffff"];
const METADATA_EXCLUDE_KEYS = [
    "symbol", "link", "text", "outlinks", "tags", "section",
    "children", "task", "checked", "annotated", "header",
    "path", "line", "lineCount", "position", "list",
    "subtasks", "real", "image", "parent", "file"
];


// ===== HELPERS =====
const isLink = (value) => value?.constructor?.name === "Link";

const normalizeToID = (value) => {
    let path = "";
    if (isLink(value)) path = value.path;
    else {
        let raw = String(value);
        if (raw.startsWith("[[") && raw.endsWith("]]")) {
            raw = raw.slice(2, -2).split("|")[0];
        }
        path = raw;
    }
    return path.replace(/\.md$/i, "").trim().toLowerCase();
};

const appendTags = (value) => {
    const raw = String(value);
    if (/^\[.*\]\(.*\)$/.test(raw)) return raw;

    const path = isLink(value) ? value.path : raw.replace(/^[[|\]]$/g, "").split("|")[0];
    const page = dv.page(path);

    if (page?.file?.tags?.length > 0) {
        const tagString = Array.from(page.file.tags).join(" ");
        return `${value} <span style="font-size: 0.8em; opacity: 0.7;">${tagString}</span>`;
    }
    return value;
};

const cleanContent = (text) => {
    const lines = (text || "").split("\n");
    let result = [];

    for (let line of lines) {
        line = line.trim();
        if (/^\s*(\w|-)+\s*::/.test(line) || line.startsWith("%%")) continue;

        line = line.replace(/\[[\w-]+::\s*\[\[([^\]]+)\]\]\]/g, '');
        line = line.replace(/\([\w-]+::\s*\[\[([^\]]+)\]\]\)/g, '');
        line = line.replace(/\[[\w-]+::\s*[^\]]*\[[^\]]+\]\([^)]+\)[^\]]*\]/g, '');
        line = line.replace(/\[[\w-]+::[^\]]*\]/g, '');
        line = line.replace(/\([\w-]+::[\w\d]+\)/g, '');
        line = line.replace(/\b[\w-]+::\s*[^\s\[]+/g, '');

        if (line) result.push(line);
    }
    return result.join(" ") || "";
};

const collectMetadata = (listItem) => {
    const metadata = {};
    const excludeKeys = [...METADATA_EXCLUDE_KEYS, ...HIDE_KEYS].map((k) => k.toLowerCase());

    for (const [key, value] of Object.entries(listItem)) {
        const lowerKey = key.toLowerCase();
        if (!excludeKeys.includes(lowerKey) && value !== undefined && value !== null && value !== "") {
            const values = Array.isArray(value) ? dv.array(value) : [value];
            metadata[key] = new Set(values.map((v) => String(v).trim()).filter(Boolean));
        }
    }

    Object.entries(metadata).forEach(([key, values]) => {
        if (values.size === 0) delete metadata[key];
    });

    return metadata;
};

const isVisible = (listItem, subject) => {
    const rawSubject = String(subject).trim();
    if (rawSubject.startsWith("#")) {
        if (!listItem.tags || listItem.tags.length === 0) return false;
        return listItem.tags.some(t => t.toLowerCase() === rawSubject.toLowerCase());
    }
    const subjectID = normalizeToID(rawSubject);
    if (listItem.outlinks?.some((link) => normalizeToID(link) === subjectID)) return true;
    return normalizeToID(listItem.text).includes(subjectID);
};

const getFilteredInternalLinks = (listItem, metadata, subject) => {
    if (!listItem.outlinks) return [];

    const subjectID = normalizeToID(subject);
    const excludeIDs = new Set([subjectID]);

    Object.values(metadata).forEach((values) => {
        values.forEach((value) => excludeIDs.add(normalizeToID(value)));
    });

    return listItem.outlinks.filter((link) => !excludeIDs.has(normalizeToID(link)));
};

const buildRelatedColumn = (internalLinks, metadata) => {
    const sections = [];
    if (internalLinks.length > 0) {
        sections.push(internalLinks.map(appendTags).join("<br>"));
    }
    Object.entries(metadata)
        .filter(([, values]) => values.size > 0)
        .sort(([a]) => a)
        .forEach(([key, values]) => {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            sections.push(`**${label}**: ${Array.from(values).map(appendTags).join(", ")}`);
        });
    return sections.join("<br>");
};


// ===== MAIN EXECUTION =====

// 1. Build Source Query
let sourceParts = [];
EXCLUDE_FOLDERS.forEach(folder => sourceParts.push(`-"${folder.replace(/"/g, '\\"')}"`));
if (EXCLUDE_CURRENT_FILE) {
    sourceParts.push(`-"${dv.current().file.path.replace(/"/g, '\\"')}"`);
}
const sourceQuery = sourceParts.length > 0 ? sourceParts.join(" AND ") : "";


// 2. Fetch & Process
const allItems = [];
const allKeys = new Set();

dv.pages(sourceQuery)
    .flatMap((page) => page.file.lists)
    .forEach((listItem) => {
        if (!isVisible(listItem, SUBJECT)) return;

        const metadata = collectMetadata(listItem);

        // If Auto-Columns is ON, record keys
        if (AUTO_COLUMNS) {
            Object.keys(metadata).forEach(k => allKeys.add(k));
        }

        const filePage = listItem.file?.link ? dv.page(listItem.file.link.path) : null;
        const sortKey = filePage?.file?.mtime || filePage?.file?.ctime;

        allItems.push({
            item: listItem,
            metadata: metadata,
            sortKey: sortKey
        });
    });

// 3. Define Columns Logic
let displayColumns = [];
if (AUTO_COLUMNS) {
    displayColumns = Array.from(allKeys).sort((a, b) => a.localeCompare(b));
} else {
    displayColumns = CUSTOM_COLUMNS; // Manually defined or empty
}

// 4. Build Rows
const rows = allItems
    .sort((a, b) => (b.sortKey < a.sortKey ? -1 : 1))
    .map(({ item, metadata }) => {
        const content = cleanContent(item.text);

        // A. Custom / Auto Columns
        const columnValues = displayColumns.map(colKey => {
            // Find key case-insensitively
            const foundKey = Object.keys(metadata).find(k => k.toLowerCase() === colKey.toLowerCase());

            if (foundKey && metadata[foundKey]) {
                const val = Array.from(metadata[foundKey]).map(appendTags).join(", ");
                // If manual or auto, we generally "consume" the metadata so it doesn't duplicate
                // But for "Bundled" view (default), we only consume if it was explicitly asked for
                delete metadata[foundKey];
                return val;
            }
            return "";
        });

        // B. Remaining Metadata & Links
        const internalLinks = getFilteredInternalLinks(item, metadata, SUBJECT);

        // If AUTO_COLUMNS is true, `metadata` will be empty (all keys consumed)
        // If AUTO_COLUMNS is false, `metadata` will contain everything NOT in CUSTOM_COLUMNS
        const relatedColumn = buildRelatedColumn(internalLinks, metadata);

        const whereColumn = item.link;

        return [content, ...columnValues, relatedColumn, whereColumn];
    });


// ===== RENDER =====
// Dynamic Headers
const colHeaders = displayColumns.map(c => c.charAt(0).toUpperCase() + c.slice(1));
const tableHeaders = ["Content", ...colHeaders, "Links & Metadata", "Where"];

if (!rows.length) {
    dv.paragraph(`⚠️ No list items found for: **${SUBJECT}**`);
} else {
    dv.table(tableHeaders, rows);
}
