
import hyperdrive from 'hyperdrive';
import fs from 'fs';
import { join } from 'path';
import type { Readable } from 'stream';
import type HyperBee from 'hyperbee';

class Hyperdrive extends hyperdrive {
    folders: HyperBee;
    stats: HyperBee;

    constructor(store, dkey = undefined) {
        if (dkey && !Buffer.isBuffer(dkey)) dkey = Buffer.from(dkey, 'hex')
        super(store, dkey);
        this.folders = this.db.sub('folders', { keyEncoding: 'utf-8', valueEncoding: 'json' });
        this.stats = this.db.sub('stats', { keyEncoding: 'utf-8', valueEncoding: 'json' });
        // this.#mkdir('/');
    }
    get peers(): any[] {
        return this.core.peers
    }
    get metadata(): any {
        return //this.core.metadata
    }
    get closed() {
        return this.core.closed
    }
    get readable(): boolean {
        return this.core.readable
    }
    get writable(): boolean {
        return this.core.writable
    }

    getFolder(path) {
        return this.folders.get(join('/', path, '/'))
    }

    readFolders(path, { recursive = false } = {}) {
        /** A nice hack */
        const self = this;
        const superList = super.list;

        const obj = ({
            entries: self.entries,
            files: self.folders,
            read: self.readdir,
            list: superList,
        });

        if (!recursive)
            return obj.read(join('/', path, '/'));
        return obj.list(join('/', path, '/'));
    }

    async exists(path: fs.PathLike) {
        return !!(await this.entry(path) || await this.getFolder(path) || (await this.#toArray(super.readdir(path))).length)
    }

    override async list(path: string, { recursive = false, stat = false } = {}) {
        const This = this
        const mapper = async (item) => {
            let name
            let pathname
            if (!recursive) {
                name = item.replace(/(^\/)|(\/$)/g, '');
                pathname = join(path, item)
            } else {
                name = item.key.replace(/(^\/)|(\/$)/g, '').split('/').at(-1)
                pathname = item.key
            }
            return ({
                name,
                pathname,
                stat: stat ? await This.stat(pathname) : undefined
            })
        };
        const folders = await this.#toArray(this.readFolders(path, { recursive }), recursive ? mapper : (path) => mapper(join(path, '/')));
        const files = await this.#toArray(super[recursive ? 'list' : 'readdir'](path, { recursive }), mapper);
        return [...folders, ...files];
    }

    async #toArray<F extends (item: any) => Promise<any>>(read: Readable, mapper?: F) {
        const items = []
        for await (const item of read) items.push(mapper ? await mapper(item) : item);
        return items
    }

    async stat(path: fs.PathLike) {
        const entry = await this.entry(path)
        const stat = (await this.stats.get(path))?.value;
        if (!entry) {
            const itemsCount = (await this.#toArray(this.readdir(path))).length
            if (!itemsCount && !stat) throw ('Path does not exist');
            return {
                ...(stat || {}),
                isDirectory: () => true,
                isFile: () => false,
                itemsCount,
            }
        }
        return {
            ...(stat || {}),
            ...(entry.value.blob), ...(entry.value.metadata || {}),
            key: entry.key, seq: entry.seq, executable: entry.value.executable, linkname: entry.value.linkname,
            isDirectory: () => !entry.value.blob,
            isFile: () => !!entry.value.blob,
            size: (entry.value.blob).byteLength
        }
        // #revist required
    }

    async #resolveDirStats(path: string, method: 'modify' | 'change' = 'modify') {
        for (const dir of await this.resolveDirs(path)) {
            await this.#setStat(dir, { method, recursive: false })
        }
    }

    async #mkdir(path: fs.PathLike, { recursive = false } = {}) {
        path = join('/', path as string, '/')
        if (recursive) await this.resolveDirs(path);
        let dir = await this.folders.get(path);
        if (dir) return dir;
        dir = await this.folders.put(path, null)
        await this.#setStat(path as string, { method: 'create' });
        return dir;
    }
    mkdir(path: fs.PathLike) {
        return this.#mkdir(path, { recursive: true })
    }

    async del(path: string, resolveStats = true) {
        path = path.replace(/\/$/, '');
        const file = await super.del(path);
        await this.stats.del(path);
        if (resolveStats) await this.#resolveDirStats(path as string);
        return file;
    }

    async rmdir(path: fs.PathLike, { recursive = false } = {}) {
        path = join('/', path as string, '/')
        const files = (await this.#toArray(this.readdir(path)))
        if (recursive) {
            for (const file in files) await this.del(file);
        } else if (files.length) throw Error('Directory is not empty');
        const dir = await this.folders.del(path);
        await this.#resolveDirStats(path as string);
        return dir;
    }

    async #sort(list, { sorting, ordering }) {
        if (sorting === 'name') {
            list.sort((a, b) => {
                return ordering * a.name.localeCompare(b.name);
            });
        } else if (sorting === 'date') {
            list.sort((a, b) => {
                return ordering * (a.stat.mtime - b.stat.mtime);
            });
        } else if (sorting === 'size') {
            list.sort((a, b) => {
                return ordering * (a.stat.size - b.stat.size);
            });
        } else if (sorting === 'type') {
            list.sort((a, b) => {
                let sort = 0;
                if (a.stat.isFile && b.stat.isFile) sort = a.stat.ctype.localeCompare(b.stat.ctype);
                else if (!a.stat.isFile && !b.stat.isFile) a.name.localeCompare(b.name);
                else sort = a.stat.isFile ? 1 : -1;
                return ordering * sort;
            });
        }
        return list;
    }

    // get items
    async $list(
        dir = '/',
        recursive = false,
        {
            offset = 0,
            limit = 100,
            page = 1,
            filter = false,
            show_hidden = true,
            ordering = 1,
            search = '',
            sorting = 'name'
        } = {}
    ) {
        // returns both files and dirs
    }

    // GRUD
    async #setStat(path: string, { method = 'create', extras = {}, recursive = true } = {} as { method?: 'access' | 'modify' | 'create' | 'change', extras?: Record<string, any>, recursive?: boolean }) {
        // path = path.replace(/\/$/, '');
        let stat = (await this.stats.get(path))?.value
        if (!stat && method != 'create') method = 'create';
        if (stat && method != 'modify') method = 'modify';

        const dt = new Date()
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
                }
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
                }
                break;
            case 'access':
                stat = {
                    ...stat,
                    ...extras,
                    atime: dt,
                    atimeMs: dt.getTime(),
                }
                break;
        }
        await this.stats.put(path, stat);
        if (recursive) await this.#resolveDirStats(path);
    }
    async resolveDirs(path: string) {
        path = path.replace(/\/$/, '');
        const paths = path.split('/');
        const dirs: string[] = [];
        for (let i = 0; i <= paths.length; i++) {
            if (!paths[i + 2]) break;
            const lastDir: string = (dirs.at(-1) || paths[i])
            dirs.push(join('/', lastDir, paths[i + 1], '/'))
        }
        await Promise.all(dirs.map((dir) => this.#mkdir(dir, { recursive: false }))) as string[];
        return dirs;
    }

    async write(path: string, content, encoding) {
        await this.put(path, Buffer.from(content, encoding));
    }

    async put(path: string, blob: Buffer, opts?) {
        path = path.replace(/\/$/, '');
        await this.resolveDirs(path);
        await super.put(path, blob, opts);
        await this.#setStat(path)
    }

    async read(path: string, encoding) {
        const content = await this.get(path);
        return content.toString(encoding);
    }
    async copy(source: string, dest: string) {

    }
    async export(drive_src = './', fs_dest = './') {

    }
    async import(fs_src = './', drive_dest = './') {

    }
}

export default Hyperdrive;
