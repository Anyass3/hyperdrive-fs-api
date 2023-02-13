import { Readable, Writable } from 'streamx';
import * as fsp from 'fs/promises';
import * as fs from 'fs';
import { resolve, join, dirname } from 'path';
export class LocalDrive {
    root;
    fsp;
    createReadStream;
    createWriteStream;
    constructor(root = './') {
        this.root = root;
        this.#initFileStream();
    }
    resolvePath(path) {
        if (!path.startsWith(this.root)) {
            path = join(this.root, path);
        }
        return resolve(path);
    }
    async *filesGenerator(dirPath, { recursive = false, fileOnly = false, withStats = false, search = '' } = {}) {
        for (const name of await fsp.readdir(dirPath)) {
            const match = name.match(search);
            const path = join(dirPath, name);
            const absolutePath = this.resolvePath(path);
            const stat = await fsp.stat(absolutePath);
            let _stats = {};
            if (withStats) {
                _stats['stat'] = stat;
            }
            if (stat.isDirectory()) {
                if (!fileOnly && match)
                    yield { path: join(path, '/'), absolutePath: join(this.resolvePath(path), '/'), name, ..._stats };
                if (recursive)
                    yield* await this.filesGenerator(path, { recursive, fileOnly, withStats, search });
            }
            else if (match)
                yield { path, absolutePath: this.resolvePath(path), name, ..._stats };
        }
    }
    list(path, opts) {
        return Array.from(this.filesGenerator(path, opts));
    }
    #initFileStream() {
        this.createReadStream = (path, opts) => {
            return fs.createReadStream(this.resolvePath(path), opts);
        };
        this.createWriteStream = (path, opts) => {
            return fs.createWriteStream(this.resolvePath(path), opts);
        };
    }
    createFolderReadStream(path) {
        const self = this;
        const files = this.filesGenerator(path, { fileOnly: true, recursive: true });
        return new Readable({
            async read(cb) {
                const { done, value } = await files.next();
                if (done) {
                    this.push(null);
                    return cb(null);
                }
                const absolutePath = self.resolvePath(value.path);
                this.push({ path: absolutePath.slice(self.resolvePath(path).length), readable: fs.createReadStream(absolutePath) });
                return cb(null);
            }
        });
    }
    createFolderWriteStream(path) {
        const self = this;
        return new Writable({
            async write(data, cb) {
                if (!data?.path || !data?.readable) {
                    return cb(null);
                }
                try {
                    const newFilepath = self.resolvePath(join(path, data.path));
                    await fsp.mkdir(dirname(newFilepath), { recursive: true });
                    const ws = fs.createWriteStream(newFilepath);
                    data.readable.pipe(ws);
                    data.readable.on('error', cb);
                    ws.on('close', cb);
                }
                catch (error) {
                    cb(error);
                }
            },
        });
    }
}
