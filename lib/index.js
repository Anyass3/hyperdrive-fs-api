import hyperdrive from 'hyperdrive';
import { join } from 'path';
class Hyperdrive extends hyperdrive {
    folders;
    stats;
    constructor(store, dkey = undefined) {
        if (dkey && !Buffer.isBuffer(dkey))
            dkey = Buffer.from(dkey, 'hex');
        super(store, dkey);
        this.folders = this.db.sub('folders', { keyEncoding: 'utf-8', valueEncoding: 'json' });
        this.stats = this.db.sub('stats', { keyEncoding: 'utf-8', valueEncoding: 'json' });
    }
    get peers() {
        return this.core.peers;
    }
    get metadata() {
        return; //this.core.metadata
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
    async exists(path) {
        return !!(this.entry(path) || await this.folders.get(path, undefined) || (await this.#toArray(super.list(path))).length);
    }
    async list(path, { recursive, stat } = { recursive: false, stat: false }) {
        const This = this;
        const mapper = async (item) => {
            let name;
            let pathname;
            if (!recursive) {
                name = item;
                pathname = join(path, item);
            }
            else {
                name = item.key.split('/').at(-1);
                pathname = item.key;
            }
            return ({
                name,
                pathname,
                stat: stat ? await This.stat(pathname) : undefined
            });
        };
        return await this.#toArray(super[recursive ? 'list' : 'readdir'](path, { recursive }), mapper);
    }
    async #toArray(read, mapper) {
        const items = [];
        for await (const item of read)
            items.push(mapper ? await mapper(item) : item);
        return items;
    }
    async stat(path) {
        const entry = await this.entry(path);
        const stat = await this.stats.get(path, undefined);
        if (!entry) {
            const itemsCount = (await this.#toArray(this.readdir(path))).length;
            if (!itemsCount)
                throw ('Path does not exist');
            return {
                ...stat.value,
                isDirectory: () => true,
                isFile: () => false,
                itemsCount,
            };
        }
        return {
            ...stat.value,
            ...(entry.value.blob), ...(entry.value.metadata || {}),
            key: entry.key, seq: entry.seq, executable: entry.value.executable, linkname: entry.value.linkname,
            isDirectory: () => !entry.value.blob,
            isFile: () => !!entry.value.blob,
            size: (entry.value.blob).byteLength
        };
        // #revist required
    }
    async #resolveDirStats(path, method = 'modify') {
        for (const dir of await this.resolveDirs(path)) {
            await this.#setStat(dir, { method });
        }
    }
    async mkdir(path) {
        const dir = await this.folders.get(path, undefined);
        if (dir)
            return dir;
        this.#setStat(path, { method: 'create' });
        return await this.folders.put(path, null, undefined);
    }
    async del(path) {
        await super.del(path);
        await this.stats.del(path, undefined);
        await this.#resolveDirStats(path);
    }
    async rmdir(path, { recursive } = { recursive: false }) {
        const files = (await this.#toArray(this.readdir(path)));
        if (recursive) {
            for (const file in files)
                await this.del(file);
        }
        else if (files.length)
            throw Error('Directory is not empty');
        await this.folders.del(path, undefined);
        await this.stats.del(path, undefined);
        await this.#resolveDirStats(path);
    }
    async #sort(list, { sorting, ordering }) {
        if (sorting === 'name') {
            list.sort((a, b) => {
                return ordering * a.name.localeCompare(b.name);
            });
        }
        else if (sorting === 'date') {
            list.sort((a, b) => {
                return ordering * (a.stat.mtime - b.stat.mtime);
            });
        }
        else if (sorting === 'size') {
            list.sort((a, b) => {
                return ordering * (a.stat.size - b.stat.size);
            });
        }
        else if (sorting === 'type') {
            list.sort((a, b) => {
                let sort = 0;
                if (a.stat.isFile && b.stat.isFile)
                    sort = a.stat.ctype.localeCompare(b.stat.ctype);
                else if (!a.stat.isFile && !b.stat.isFile)
                    a.name.localeCompare(b.name);
                else
                    sort = a.stat.isFile ? 1 : -1;
                return ordering * sort;
            });
        }
        return list;
    }
    // get items
    async $list(dir = '/', recursive = false, { offset = 0, limit = 100, page = 1, filter = false, show_hidden = true, ordering = 1, search = '', sorting = 'name' } = {}) {
        // returns both files and dirs
    }
    // GRUD
    async #setStat(path, { method = 'create', extras = {}, recursive = true } = {}) {
        path = path.replace(/\/$/, '');
        let stat = (await this.stats.get(path, undefined))?.value;
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
        await this.stats.put(path, stat, undefined);
        if (recursive)
            await this.#resolveDirStats(path);
    }
    async resolveDirs(path) {
        path = path.replace(/\/$/, '');
        const paths = path.split('/');
        const dirs = [];
        for (let i = 0; i <= paths.length; i++) {
            if (!paths[i + 2])
                break;
            const lastDir = (dirs.at(-1) || ('/' + paths[i]));
            dirs.push(lastDir + (lastDir == '/' ? '' : '/') + paths[i + 1]);
        }
        await Promise.all(dirs.map((dir) => this.mkdir(dir)));
        return dirs;
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
    async copy(source, dest) {
    }
    async export(drive_src = './', fs_dest = './') {
    }
    async import(fs_src = './', drive_dest = './') {
    }
}
export default Hyperdrive;
