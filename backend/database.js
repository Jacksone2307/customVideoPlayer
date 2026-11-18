const { DatabaseSync } = require("node:sqlite");

function createVideosTable(database, tableName = "videos") {
    database.exec(`
        CREATE TABLE ${tableName} (
            file_name TEXT PRIMARY KEY,
            uploaded_at TEXT
        )
    `);
}

function migrateSchema(database) {
    const table = database.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'videos'"
    ).get();

    if (!table) {
        createVideosTable(database);
        return;
    }

    const columns = database.prepare("PRAGMA table_info(videos)").all();
    const hasFileName = columns.some((column) => column.name === "file_name");
    const hasUploadedAt = columns.some((column) => column.name === "uploaded_at");
    if (!hasFileName) {
        throw new Error("Cannot migrate videos table: file_name column is missing.");
    }
    if (columns.length === 2 && hasUploadedAt) {
        return;
    }

    database.exec("BEGIN");
    try {
        createVideosTable(database, "videos_replacement");
        database.exec(`
            INSERT INTO videos_replacement (file_name, uploaded_at)
            SELECT file_name, ${hasUploadedAt ? "uploaded_at" : "NULL"}
            FROM videos
        `);
        database.exec("DROP TABLE videos");
        database.exec("ALTER TABLE videos_replacement RENAME TO videos");
        database.exec("COMMIT");
    } catch (error) {
        database.exec("ROLLBACK");
        throw error;
    }
}

function openVideoDatabase(databasePath) {
    const database = new DatabaseSync(databasePath);
    migrateSchema(database);

    const insertVideo = database.prepare(
        "INSERT INTO videos (file_name, uploaded_at) VALUES (?, ?) ON CONFLICT(file_name) DO NOTHING"
    );
    const deleteVideo = database.prepare("DELETE FROM videos WHERE file_name = ?");
    const findVideo = database.prepare(
        "SELECT file_name, uploaded_at FROM videos WHERE file_name = ?"
    );
    const listVideos = database.prepare(
        "SELECT file_name, uploaded_at FROM videos ORDER BY uploaded_at DESC, file_name COLLATE NOCASE"
    );
    const storedVideos = database.prepare("SELECT file_name FROM videos");

    return {
        syncVideos(videos) {
            const currentFiles = new Set(videos.map((video) => video.fileName));
            database.exec("BEGIN");
            try {
                for (const { file_name: fileName } of storedVideos.all()) {
                    if (!currentFiles.has(fileName)) {
                        deleteVideo.run(fileName);
                    }
                }
                for (const video of videos) {
                    insertVideo.run(video.fileName, video.uploadedAt);
                }
                database.exec("COMMIT");
            } catch (error) {
                database.exec("ROLLBACK");
                throw error;
            }
        },
        findVideo(fileName) {
            return findVideo.get(fileName);
        },
        listVideos() {
            return listVideos.all();
        },
        close() {
            database.close();
        }
    };
}

module.exports = { openVideoDatabase };
