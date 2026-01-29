# Content Metadata View for Obsidian

A **DataviewJS** script that aggregates and visualizes content related to a specific subject within an Obsidian vault. It queries both **List Items** and **Pages**, rendering them in a configurable table with support for recursive tagging, implicit inheritance, and dynamic metadata columns.

## Capabilities

* **Mixed Entity Rendering:** Displays matching Files and List Items in a single view.
* **Recursive Tag Matching:** Queries for `#tag` include nested tags (e.g., `#tag/subtag`).
* **Implicit Inheritance:** List items inherit context from their parent file's Frontmatter tags.
* **Dynamic Metadata:** Automatically detects inline fields (e.g., `key:: value`) and generates columns.
* **Link \& Text Matching:** Filters items by Wikilink references or plain text occurrences.


## Installation

1. Verify that the **Dataview** plugin is installed and "Enable JavaScript Queries" is active.
2. Copy `content-metadata-view.js` to your vault (recommended path: `_utils/_dataview_scripts/`).

## Usage

Insert a `dataviewjs` block in any note. The script defaults to using the current file name as the search subject.

```javascript
await dv.view("_utils/_dataview_scripts/content-metadata-view");
```


### Configuration

A configuration object can be passed as the second argument to `dv.view`.

```javascript
await dv.view("_utils/_dataview_scripts/content-metadata-view", {
    subject: "#project",      // Target Link or Tag
    auto_columns: true,       // Generate columns from found metadata
    exclude_current: true     // Hide items from the active file
});
```

| Option | Type | Default | Description |
| :-- | :-- | :-- | :-- |
| `subject` | `string` | `current file` | The search target. Accepts `[[Link]]`, `"Text"`, or `"#tag"`. |
| `columns` | `array` | `[]` | Whitelist of metadata keys to display as columns. |
| `auto_columns` | `boolean` | `false` | If `true`, creates columns for all unique keys found in results. |
| `show_pages` | `boolean` | `true` | Include File objects that match the subject. |
| `show_lists` | `boolean` | `true` | Include List Items that match the subject. |
| `exclude_current` | `boolean` | `false` | Excludes the file where the query is running. |
| `exclude_folders` | `array` | `["_utils"]` | Array of folder paths to exclude from search. |
| `limit` | `number` | `100` | Maximum number of rows to render. |
| `debug` | `boolean` | `false` | Logs query execution details to the Developer Console. |

## Query Logic

### Tag Handling

* **Recursion:** A query for `#parent` returns items tagged `#parent` and `#parent/child`.
* **Inheritance:**
    * **Pages:** A file matches if the tag exists in its YAML Frontmatter.
    * **Lists:** List items match if they contain the tag inline OR if their parent file contains the tag in Frontmatter.


### Link Handling

* **Pages:** A file matches if it contains an outgoing link to the subject.
* **Lists:** An item matches if it contains a link to the subject or contains the subject string in plain text.

