import hyperdrive from 'hyperdrive';
import { join } from 'path';
// @ts-ignore
import { Readable, Writable, pipelinePromise } from 'streamx';
import { LocalDrive } from './localdrive.js';
class Hyperdrive extends hyperdrive {
    stats;
    local;
    _list;
    _readdir;
    constructor(store, dkey, localDriveRoot) {
        if (dkey && !Buffer.isBuffer(dkey))
            dkey = Buffer.from(dkey, 'hex');
        super(store, dkey);
        this._readdir = super.readdir;
        this._list = super.list;
        this.stats = this.db.sub('stats', { keyEncoding: 'utf-8', valueEncoding: 'json' });
        this.local = new LocalDrive(localDriveRoot);
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
        if (readable)
            return this.#shallowReadStream(folder, { nameOnly, fileOnly, withStats, search });
        return this.#toArray(this.#shallowReadGenerator(folder, { nameOnly, fileOnly, withStats, search }));
    }
    list(folder, { recursive = true, withStats = false, fileOnly = false, readable = false, search = '' } = {}) {
        if (!readable) {
            if (recursive)
                return this.#toArray(this.#listGenerator(folder, { withStats, fileOnly, search }));
            return this.#toArray(this.#shallowReadGenerator(folder, { withStats, fileOnly, search }));
        }
        if (recursive)
            return this.#list(folder, { withStats, fileOnly, search });
        return this.readdir(folder, { withStats, fileOnly, readable: true, search });
    }
    async throwErrorOnExists(path, isDir = false) {
        if (isDir) {
            if ((await this.entry(path)))
                throw Error('File already exists: ' + path);
        }
        else if (await this.isDirectory(path)) {
            throw Error('Directory already exists: ' + path);
        }
        await this.getDirs(path, { resolve: true });
    }
    async write(path, content, encoding) {
        return await this.put(path, Buffer.from(content, encoding));
    }
    async put(path, blob, opts) {
        path = path.replace(/\/$/, '');
        await this.throwErrorOnExists(path);
        const node = await super.put(path, blob, opts);
        await this.#setStat(path);
        return node;
    }
    async read(path, encoding) {
        const content = await this.get(path);
        return content?.toString(encoding);
    }
    async del(path) {
        return this.#del(path, true);
    }
    async rmDir(path, { recursive = false } = {}) {
        path = path.replace(/\/$/, '');
        if (!recursive) {
            if ((await this.isDirectory(path))) {
                throw Error(`Directory is not empty. 
                Set optional recursive option to true;
                to delete it with it's contents`);
            }
        }
        for await (const item of this.list(path, { recursive, readable: true })) {
            await this.del(item.stat);
        }
        await this.stats.del(path);
    }
    async copy(source, dest) {
        const node = await this.entry(source);
        if (!node?.value.blob)
            throw Error('Source file does not exist: ' + source);
        await this.throwErrorOnExists(dest);
        // this.createReadStream(source).pipe(this.createWriteStream(dest));
        return this.files.put(join('/', dest), { ...node });
    }
    async move(source, dest) {
        const node = await this.entry(source);
        if (!node?.value.blob)
            throw Error('Source file does not exist: ' + source);
        await this.throwErrorOnExists(dest);
        const newNode = await this.files.put(join('/', dest), { ...node.value });
        await this.del(source);
        return newNode;
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
        let checkedWritability = false;
        return new Writable({
            async write(data, cb) {
                if (!data?.path || !data?.readable) {
                    return cb(null);
                }
                if (!checkedWritability)
                    try {
                        await self.throwErrorOnExists(path, true);
                        checkedWritability = true;
                    }
                    catch (error) {
                        return cb(error);
                    }
                ;
                try {
                    await self.throwErrorOnExists(data.path);
                }
                catch (error) {
                    return cb(error);
                }
                const ws = self.createWriteStream(join(path, data.path));
                data.readable.pipe(ws);
                data.readable.on('error', cb);
                ws.on('close', cb);
            },
        });
    }
    async isDirectory(path) {
        const node = await this.#iteratorPeek(path.replace(/\/$/, ''), '/');
        if (!node)
            return false;
        return true;
    }
    async exists(path) {
        return !!(await this.entry(path) || (await this.isDirectory(path)));
    }
    async stat(path) {
        path = path.replace(/\/$/, '');
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
    async getDirs(path, { exclude = '', resolve = false } = {}) {
        path = path.replace(/\/$/, '');
        const paths = path.split('/');
        const dirs = [];
        for (let i = 0; i <= paths.length; i++) {
            if (!paths[i + 2])
                break;
            const lastDir = (dirs.at(-1) || paths[i]);
            const dir = join('/', lastDir, paths[i + 1]);
            if (join('/', exclude) == dir)
                continue;
            if (resolve && await this.entry(dir))
                throw Error('File already exists: ' + dir);
            dirs.push(dir);
        }
        return dirs;
    }
    async export(path = '/', localPath = './') {
        await pipelinePromise(this.createFolderReadStream(path), this.local.createFolderWriteStream(localPath));
    }
    async import(localPath = './', path = '/') {
        await pipelinePromise(this.local.createFolderReadStream(localPath), this.createFolderWriteStream(path));
    }
    async #del(path, resolveStats = true) {
        path = path.replace(/\/$/, '');
        const node = await super.del(path);
        await this.stats.del(path);
        if (resolveStats)
            await this.#resolveDirStats(path);
        return node;
    }
    async #countReadable(read) {
        let count = 0;
        for await (const _ of read)
            count++;
        return count;
    }
    #getNodeName(node, folder) {
        const suffix = node.key.slice(folder.length + 1);
        const i = suffix.indexOf('/');
        const name = i === -1 ? suffix : suffix.slice(0, i);
        // const isFile: boolean = node.key.endsWith(name)// && !!node.value;
        return { name, isFile: node.key.endsWith(name) };
    }
    async #iteratorPeek(folder, prev) {
        let node = null;
        // let skip: boolean;
        const ite = this.files.createRangeIterator({
            gt: folder + prev,
            lt: folder + '0', limit: 1
        });
        try {
            await ite.open();
            node = await ite.next();
            // if (node && !node.value) skip = true;
        }
        finally {
            await ite.close();
        }
        return node; // { node, skip };
    }
    async #mapper(key, { /* path = '',*/ withStats = false } = {}) {
        const self = this;
        let name;
        // let pathname: string;
        // if (typeof item == 'string') {
        //     name = item.replace(/(^\/)|(\/$)/g, '');
        //     pathname = join(path, item)
        // } else {
        name = key.replace(/(^\/)|(\/$)/g, '').split('/').at(-1);
        // pathname = key
        // }
        const mapped = ({
            name,
            path: key
        });
        if (!withStats)
            return mapped;
        mapped['stat'] = await self.stat(key);
        return mapped;
    }
    async *#shallowReadGenerator(folder, { nameOnly = false, fileOnly = false, withStats = false, search = '' } = {}) {
        folder = folder.replace(/\/$/, '');
        let prev = '/';
        while (true) {
            const node = await this.#iteratorPeek(folder, prev);
            // if (skip) {
            //     continue;
            // }
            if (!node) {
                break;
            }
            const { name, isFile } = this.#getNodeName(node, folder);
            prev = '/' + name + '0';
            if ((search && !name.match(search)) || (fileOnly && !isFile)) {
                continue;
            }
            yield !nameOnly ? await this.#mapper(join(folder, name), { withStats }) : name;
        }
    }
    #shallowReadStream(folder, opts) {
        return this.#generatorToReadable(this.#shallowReadGenerator(folder, opts));
    }
    async *#listGenerator(folder, { fileOnly = false, withStats = false, search = '' } = {}) {
        folder = folder.replace(/\/$/, '');
        let dirs = [];
        for await (const node of this.entries({
            gt: folder + '/', lt: folder + '0'
        })) {
            if (search && !node.key.match(search))
                continue;
            if (!fileOnly)
                dirs = [...new Set([...dirs, ...await this.getDirs(node.key, { exclude: folder })])];
            const mappedNode = await this.#mapper(node.key, { withStats });
            if (!search || mappedNode.name.match(search))
                yield mappedNode;
        }
        if (fileOnly)
            return;
        //    yield* dirs.map(dir => ({ key: dir }))
        for (const dir of dirs) {
            yield await this.#mapper(dir, { withStats });
        }
    }
    #list(folder, opts) {
        return this.#generatorToReadable(this.#listGenerator(folder, opts));
    }
    #generatorToReadable(readableGenerator) {
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
        path = join('/', path.replace(/\/$/, ''));
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
export { LocalDrive, Hyperdrive };
