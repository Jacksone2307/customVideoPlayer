const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const projectDirectory = path.resolve(__dirname, "..");
const frontendDirectory = path.join(projectDirectory, "frontend");
const videoDirectory = path.join(__dirname, "videos");
const databasePath = path.join(__dirname, "videos.sqlite");
const supportedVideoTypes = new Map([
    [".mp4", "video/mp4"],
    [".m4v", "video/mp4"],
    [".mov", "video/quicktime"],
    [".ogv", "video/ogg"],
    [".ogg", "video/ogg"],
    [".webm", "video/webm"]
]);

fs.mkdirSync(videoDirectory, { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
    CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        file_name TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL
    )
`);

const saveVideo = database.prepare(`
    INSERT INTO videos (id, title, file_name, mime_type, size)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        file_name = excluded.file_name,
        mime_type = excluded.mime_type,
        size = excluded.size
`);
const deleteVideo = database.prepare("DELETE FROM videos WHERE file_name = ?");
const findVideo = database.prepare(
    "SELECT id, title, file_name, mime_type, size FROM videos WHERE id = ?"
);
const listVideos = database.prepare(
    "SELECT id, title, file_name, mime_type, size FROM videos ORDER BY title COLLATE NOCASE"
);

function titleFromFileName(fileName) {
    return path.basename(fileName, path.extname(fileName))
        .replace(/[_-]+/g, " ")
        .trim();
}

function indexVideos() {
    const videoFiles = fs.readdirSync(videoDirectory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && supportedVideoTypes.has(path.extname(entry.name).toLowerCase()));
    const currentFiles = new Set(videoFiles.map((entry) => entry.name));

    for (const { file_name: fileName } of database.prepare("SELECT file_name FROM videos").all()) {
        if (!currentFiles.has(fileName)) {
            deleteVideo.run(fileName);
        }
    }

    for (const entry of videoFiles) {
        const fileName = entry.name;
        const stats = fs.statSync(path.join(videoDirectory, fileName));
        const mimeType = supportedVideoTypes.get(path.extname(fileName).toLowerCase());
        saveVideo.run(fileName, titleFromFileName(fileName), fileName, mimeType, stats.size);
    }
}

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(data));
}

function sendNotFound(response) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
}

function serveStaticFile(request, response, filePath) {
    if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" });
        response.end();
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            console.error(`Unable to read ${filePath}:`, error);
            response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("Unable to load the site.");
            return;
        }

        const contentType = filePath.endsWith(".css")
            ? "text/css; charset=utf-8"
            : filePath.endsWith(".js") || filePath.endsWith(".mjs")
                ? "text/javascript; charset=utf-8"
                : "text/html; charset=utf-8";
        response.writeHead(200, {
            "Content-Type": contentType,
            "Content-Length": content.length
        });
        response.end(request.method === "HEAD" ? undefined : content);
    });
}

function parseByteRange(rangeHeader, size) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    if (!match || size === 0) {
        return null;
    }

    let start;
    let end;
    if (match[1] === "") {
        const suffixLength = Number(match[2]);
        if (!suffixLength) {
            return null;
        }
        start = Math.max(size - suffixLength, 0);
        end = size - 1;
    } else {
        start = Number(match[1]);
        end = match[2] === "" ? size - 1 : Number(match[2]);
        if (start >= size || start > end) {
            return null;
        }
        end = Math.min(end, size - 1);
    }

    return { start, end };
}

function serveVideo(request, response, fileName) {
    const video = findVideo.get(fileName);
    if (!video || path.basename(fileName) !== fileName) {
        sendNotFound(response);
        return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" });
        response.end();
        return;
    }

    const filePath = path.join(videoDirectory, video.file_name);
    const rangeHeader = request.headers.range;
    const range = rangeHeader ? parseByteRange(rangeHeader, video.size) : null;
    if (rangeHeader && !range) {
        response.writeHead(416, {
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes */${video.size}`
        });
        response.end();
        return;
    }

    const statusCode = range ? 206 : 200;
    const start = range ? range.start : 0;
    const end = range ? range.end : video.size - 1;
    response.writeHead(statusCode, {
        "Accept-Ranges": "bytes",
        "Content-Type": video.mime_type,
        "Content-Length": range ? end - start + 1 : video.size,
        ...(range ? { "Content-Range": `bytes ${start}-${end}/${video.size}` } : {})
    });

    if (request.method === "HEAD" || video.size === 0) {
        response.end();
        return;
    }

    const stream = fs.createReadStream(filePath, { start, end });
    stream.on("error", (error) => {
        console.error(`Unable to stream ${filePath}:`, error);
        if (!response.headersSent) {
            sendNotFound(response);
        } else {
            response.destroy(error);
        }
    });
    stream.pipe(response);
}

indexVideos();

const staticFiles = new Map([
    ["/", path.join(frontendDirectory, "index.html")],
    ["/index.html", path.join(frontendDirectory, "index.html")],
    ["/css/style.css", path.join(frontendDirectory, "css", "style.css")],
    ["/components/video-datasource.js", path.join(frontendDirectory, "components", "video-datasource.js")],
    ["/components/video-player.js", path.join(frontendDirectory, "components", "video-player.js")],
    ["/components/video-catalogue.js", path.join(frontendDirectory, "components", "video-catalogue.js")],
    ["/components/helpers/format-file-size.js", path.join(frontendDirectory, "components", "helpers", "format-file-size.js")],
    ["/vendor/ag-grid-community/main.esm.mjs", path.join(projectDirectory, "node_modules", "ag-grid-community", "dist", "package", "main.esm.mjs")],
    ["/vendor/ag-stack/main.esm.mjs", path.join(projectDirectory, "node_modules", "ag-stack", "dist", "package", "main.esm.mjs")]
]);

const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://localhost");

    if (requestUrl.pathname === "/api/videos") {
        if (request.method !== "GET") {
            response.writeHead(405, { Allow: "GET" });
            response.end();
            return;
        }

        sendJson(response, 200, listVideos.all().map((video) => ({
            id: video.id,
            title: video.title,
            size: video.size,
            contentType: video.mime_type,
            url: `/api/videos/${encodeURIComponent(video.id)}`
        })));
        return;
    }

    if (requestUrl.pathname.startsWith("/api/videos/")) {
        let fileName;
        try {
            fileName = decodeURIComponent(requestUrl.pathname.slice("/api/videos/".length));
        } catch {
            sendNotFound(response);
            return;
        }
        serveVideo(request, response, fileName);
        return;
    }

    const staticFile = staticFiles.get(requestUrl.pathname);
    if (staticFile) {
        serveStaticFile(request, response, staticFile);
        return;
    }

    sendNotFound(response);
});

const port = Number(process.env.PORT || 8000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
}

server.listen(port, "127.0.0.1", () => {
    console.log(`Video library running at http://localhost:${port}`);
    console.log(`Place video files in ${videoDirectory}, then restart the server to index them.`);
});

server.on("close", () => database.close());
