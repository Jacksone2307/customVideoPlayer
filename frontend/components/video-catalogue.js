import {
    AllCommunityModule,
    colorSchemeVariable,
    createGrid,
    ModuleRegistry,
    themeQuartz
} from "ag-grid-community";
import { formatFileSize } from "./helpers/format-file-size.js";

ModuleRegistry.registerModules([AllCommunityModule]);

class VideoCatalogue extends HTMLElement {
    connectedCallback() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        this.innerHTML = `
            <header class="catalogue-header">
                <div>
                    <p class="catalogue-label">YOUR COLLECTION</p>
                    <h2>Find something to watch</h2>
                </div>
                <span class="catalogue-count" aria-live="polite"></span>
            </header>
            <div data-grid></div>
            <div role="status" hidden></div>
        `;

        this.count = this.querySelector(".catalogue-count");
        this.grid = this.querySelector("[data-grid]");
        this.message = this.querySelector("[role=status]");
        this.gridApi = createGrid(this.grid, {
            columnDefs: [
                { field: "title", headerName: "Video", flex: 2, minWidth: 120, sortable: true },
                {
                    field: "size",
                    headerName: "Size",
                    flex: 1,
                    minWidth: 90,
                    sortable: true,
                    valueFormatter: ({ value }) => formatFileSize(value)
                },
                {
                    field: "uploadedAt",
                    headerName: "Uploaded",
                    flex: 1,
                    minWidth: 120,
                    sort: "desc",
                    valueFormatter: ({ value }) => value
                        ? new Date(value).toLocaleDateString()
                        : ""
                }
            ],
            defaultColDef: { resizable: true },
            getRowId: ({ data }) => data.id,
            rowSelection: {
                mode: "singleRow",
                checkboxes: false,
                headerCheckbox: false,
                enableClickSelection: true
            },
            theme: themeQuartz.withPart(colorSchemeVariable).withParams({
                accentColor: "var(--green)",
                backgroundColor: "var(--surface)",
                borderColor: "var(--border)",
                foregroundColor: "var(--text)",
                headerBackgroundColor: "var(--surface-raised)",
                headerTextColor: "var(--text)"
            }),
            onRowClicked: ({ data }) => {
                this.dispatchEvent(new CustomEvent("video-selected", {
                    bubbles: true,
                    detail: { video: data }
                }));
            },
            overlayNoRowsTemplate:
                '<span>No videos found. Add files to backend/videos and restart the server.</span>',
            rowData: []
        });
    }

    setVideos(videos) {
        this.message.hidden = true;
        this.grid.hidden = false;
        this.count.textContent = `${videos.length} ${videos.length === 1 ? "video" : "videos"}`;
        this.gridApi.setGridOption("rowData", videos);

        if (videos.length > 0) {
            this.gridApi.getRowNode(videos[0].id)?.setSelected(true);
            this.dispatchEvent(new CustomEvent("video-selected", {
                bubbles: true,
                detail: { video: videos[0] }
            }));
        }
    }

    setError() {
        this.grid.hidden = true;
        this.count.textContent = "";
        this.message.replaceChildren();
        this.message.append("Your library couldn't be loaded. ");

        const retry = document.createElement("button");
        retry.type = "button";
        retry.textContent = "Try again";
        retry.addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("video-retry", { bubbles: true }));
        });
        this.message.append(retry);
        this.message.hidden = false;
    }
}

customElements.define("video-catalogue", VideoCatalogue);
