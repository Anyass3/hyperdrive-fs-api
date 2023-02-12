import hyperdrive from 'hyperdrive';
import { join } from 'path';
// @ts-ignore
import { Readable, Transform, pipeline, Writable } from 'streamx';
class Hyperdrive extends hyperdrive {
    stats;
    constructor(store, dkey = undefined) {
        if (dkey && !Buffer.isBuffer(dkey))
            dkey = Buffer.from(dkey, 'hex');
        super(store, dkey);
        this.stats = this.db.sub('stats', { keyEncoding: 'utf-8', valueEncoding: 'json' });
    }
    get peers() {
        return this.core.peers;
    }
    get metadata() {
        return this.core.metadata;
    }
    get closed() {
        return this.core.closed;
    }
    get readable() {
        return this.core.readable;
    }
    get writable() {
        return this.core.writable;
    }
    readdir(folder = '/', { withStats = false, nameOnly = false, fileOnly = false, readable = false, search = '' } = {}) {
        if (folder.endsWith('/'))
            folder = folder.slice(0, -1);
        const _readable = this.#shallowReadStream(folder, { nameOnly, fileOnly, withStats, search });
        if (readable)
            return _readable;
        return this.#toArray(_readable);
    }
    list(path, { recursive = true, withStats = false, fileOnly = false, readable = false, search = '' } = {}) {
        let _readable;
        if (recursive) {
            _readable = this.#list(path, { withStats, fileOnly, search });
        }
        else {
            _readable = this.readdir(path, { withStats, fileOnly, readable: true, search });
        }
        if (readable !== false)
            return _readable;
        return this.#toArray(_readable);
    }
    async write(path, content, encoding) {
        await this.put(path, Buffer.from(content, encoding));
    }
    async put(path, blob, opts) {
        path = path.replace(/\/$/, '');
        await super.put(path, blob, opts);
        await this.#setStat(path);
    }
    async read(path, encoding) {
        const content = await this.get(path);
        return content.toString(encoding);
    }
    async del(path, resolveStats = true) {
        path = path.replace(/\/$/, '');
        const file = await super.del(path);
        await this.stats.del(path);
        if (resolveStats)
            await this.#resolveDirStats(path);
        return file;
    }
    async copy(source, dest) {
        const node = await this.entry(source);
        if (!node?.value.blob)
            throw Error('Source file does not exist');
        // this.createReadStream(source).pipe(this.createWriteStream(dest));
        return this.files.put(join('/', dest), { ...node });
    }
    async move(source, dest) {
        const node = await this.entry(source);
        if (!node?.value.blob)
            throw Error('Source file does not exist');
        await this.files.put(join('/', dest), { ...node.value });
        await this.del(source);
    }
    createFolderReadStream(path) {
        const self = this;
        const files = this.#toGenerator(super.list(path, { recursive: true }));
        return new Readable({
            async read(cb) {
                const { done, value } = await files.next();
                if (done) {
                    this.push(null);
                    return cb(null);
                }
                this.push({ path: value.key.slice(path.length), readable: self.createReadStream(value.key) });
                return cb(null);
            }
        });
    }
    createFolderWriteStream(path) {
        const self = this;
        return new Writable({
            write(data, cb) {
                if (!data?.path || !data?.readable) {
                    return cb(null);
                }
                const ws = self.createWriteStream(join(path, data.path));
                data.readable.pipe(ws);
                ws.on('close', cb);
            },
        });
    }
    async exists(path) {
        return !!(await this.entry(path) || (await this.#toArray(super.readdir(path))).length);
    }
    async stat(path) {
        const entry = await this.entry(path);
        const stat = (await this.stats.get(path))?.value;
        if (!entry) {
            const itemsCount = (await this.readdir(path, { readable: false })).length;
            if (!itemsCount && !stat)
                throw Error('Path does not exist');
            return {
                ...(stat || {}),
                isDirectory: () => true,
                isFile: () => false,
                itemsCount,
            };
        }
        return {
            ...(stat || {}),
            ...(entry.value.blob), ...(entry.value.metadata || {}),
            key: entry.key, seq: entry.seq, executable: entry.value.executable, linkname: entry.value.linkname,
            isDirectory: () => !entry.value.blob,
            isFile: () => !!entry.value.blob,
            size: (entry.value.blob).byteLength
        };
    }
    getDirs(path, exclude = '') {
        path = path.replace(/\/$/, '');
        const paths = path.split('/');
        const dirs = [];
        for (let i = 0; i <= paths.length; i++) {
            if (!paths[i + 2])
                break;
            const lastDir = (dirs.at(-1) || paths[i]);
            const dir = join('/', lastDir, paths[i + 1], '/');
            if (join('/', exclude, '/') == dir)
                continue;
            dirs.push(dir);
        }
        return dirs;
    }
    async export(drive_src = './', fs_dest = './') {
        throw Error('Yikes! export is not Implemented yet');
    }
    async import(fs_src = './', drive_dest = './') {
        throw Error('Yikes! import is not Implemented yet');
    }
    // get items
    async $list(dir = '/', recursive = false, { offset = 0, limit = 100, page = 1, filter = false, show_hidden = true, ordering = 1, search = '', sorting = 'name' } = {}) {
        throw Error('Yikes! $list is not Implemented yet');
        // returns both files and dirs
    }
    #getNodeName(node, folder) {
        const suffix = node.key.slice(folder.length + 1);
        const i = suffix.indexOf('/');
        const name = i === -1 ? suffix : suffix.slice(0, i);
        const isFile = node.key.endsWith(name) && node.value;
        return { name, dir: !isFile ? name + '/' : null, pathname: join(folder, name, !isFile ? '/' : '') };
    }
    async #iteratorPeek(folder, prev, fileOnly = false) {
        let node = null, nextNode = null, skip = false;
        /** Yes two nodes in case a file and a folder have the same name*/
        const ite = this.files.createRangeIterator({
            gt: folder + prev,
            lt: folder + '0', limit: 2
        });
        try {
            await ite.open();
            node = await ite.next();
            if (!fileOnly) {
                const next = await ite.next();
                if (next) {
                    if (next.key.startsWith(node.key))
                        nextNode = { seq: null, key: node.key + '/', value: null };
                }
            }
            else if (node && !node.value)
                skip = true;
        }
        finally {
            await ite.close();
        }
        return { node, nextNode, skip };
    }
    async #mapper(item, { path = '', withStats = false } = {}) {
        const self = this;
        let name;
        let pathname;
        if (typeof item == 'string') {
            name = item.replace(/(^\/)|(\/$)/g, '');
            pathname = join(path, item);
        }
        else {
            name = item.key.replace(/(^\/)|(\/$)/g, '').split('/').at(-1);
            pathname = item.key;
        }
        const mapped = ({
            name,
            path: pathname
        });
        if (!withStats)
            return mapped;
        mapped['stat'] = await self.stat(pathname);
        return mapped;
    }
    ;
    async *#shallowReadGenerator(folder, { nameOnly = false, fileOnly = false, withStats = false, search = '' } = {}) {
        let canRead = true;
        let prev = '/';
        while (canRead) {
            const { node, nextNode, skip } = await this.#iteratorPeek(folder, prev, fileOnly);
            if (skip) {
                continue;
            }
            if (!node) {
                canRead = true;
                break;
            }
            const { name, dir, pathname } = this.#getNodeName(node, folder);
            prev = '/' + name + '0';
            if (search && !name.match(search)) {
                continue;
            }
            if (nextNode) {
                yield !nameOnly ? await this.#mapper(node, { withStats }) : name;
                yield !nameOnly ? await this.#mapper({ key: join(pathname, '/') }, { withStats }) : name + '/';
            }
            yield !nameOnly ? await this.#mapper({ key: pathname }, { withStats }) : dir || name;
        }
    }
    #shallowReadStream(folder, opts) {
        const readableGenerator = this.#shallowReadGenerator(folder, opts);
        return new Readable({
            async read(cb) {
                try {
                    const { done, value } = await readableGenerator.next();
                    if (done) {
                        this.push(null);
                        return cb(null);
                    }
                    this.push(value);
                    cb(null);
                }
                catch (error) {
                    cb(error);
                }
            }
        });
    }
    #list(folder, { fileOnly = false, withStats = false, search = '' } = {}) {
        folder = folder.replace(/\/$/, '');
        let dirs = [];
        const self = this;
        return pipeline(this.entries({
            gt: folder + '/', lt: folder + '0'
        }), new Transform({
            transform(node, callback) {
                if (search && !node.key.match(search))
                    return callback();
                if (!fileOnly)
                    dirs = [...new Set([...dirs, ...self.getDirs(node.key, folder)])];
                self.#mapper(node, { withStats }).then((node) => {
                    if (!search || node.name.match(search))
                        this.push(node);
                }).finally(callback);
            },
            flush(callback) {
                dirs.forEach((dir) => {
                    self.#mapper({ key: dir }, { withStats }).then((node) => {
                        if (!search || node.name.match(search))
                            this.push(node);
                    }).finally(callback);
                });
            }
        }));
    }
    async #toArray(read, mapper) {
        const items = [];
        for await (const item of read)
            items.push(mapper ? await mapper(item) : item);
        return items;
    }
    async *#toGenerator(read) {
        for await (const item of read)
            yield item;
    }
    async #resolveDirStats(path, method = 'modify') {
        for (const dir of await this.getDirs(path)) {
            await this.#setStat(dir, { method, recursive: false });
        }
    }
    async #setStat(path, { method = 'create', extras = {}, recursive = true } = {}) {
        // path = path.replace(/\/$/, '');
        let stat = (await this.stats.get(path))?.value;
        if (!stat && method != 'create')
            method = 'create';
        if (stat && method != 'modify')
            method = 'modify';
        const dt = new Date();
        switch (method) {
            case 'create':
                stat = {
                    atime: dt,
                    mtime: dt,
                    ctime: dt,
                    birthtime: dt,
                    atimeMs: dt.getTime(),
                    mtimeMs: dt.getTime(),
                    ctimeMs: dt.getTime(),
                    birthtimeMs: dt.getTime(),
                    ...extras
                };
                break;
            case 'change':
            case 'modify':
                stat = {
                    ...stat,
                    ...extras,
                    mtime: dt,
                    ctime: dt,
                    mtimeMs: dt.getTime(),
                    ctimeMs: dt.getTime(),
                };
                break;
            case 'access':
                stat = {
                    ...stat,
                    ...extras,
                    atime: dt,
                    atimeMs: dt.getTime(),
                };
                break;
        }
        await this.stats.put(path, stat);
        if (recursive)
            await this.#resolveDirStats(path);
    }
}
export default Hyperdrive;
