
import hyperdrive from 'hyperdrive';
import fs from 'fs';
import { join } from 'path';
import { pipeline, Readable, Transform, } from 'streamx';
import type HyperBee from 'hyperbee';

type HyperBlob = { byteOffset: number; blockOffset: number; blockLength: number; byteLength: number }
type Node = { seq: number | null; key: string; value: HyperBlob | null }

class Hyperdrive extends hyperdrive {
    folders: HyperBee;
    stats: HyperBee;

    constructor(store, dkey = undefined) {
        if (dkey && !Buffer.isBuffer(dkey)) dkey = Buffer.from(dkey, 'hex')
        super(store, dkey);
        this.stats = this.db.sub('stats', { keyEncoding: 'utf-8', valueEncoding: 'json' });
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

    readdir(folder = '/', { stat = false, nameOnly = false, fileOnly = false, readable = false } = {}) {
        if (folder.endsWith('/')) folder = folder.slice(0, -1)
        const _readable: Readable = this.#shallowReadStream(folder, { nameOnly, fileOnly, stat })
        if (readable) return _readable;
        return this.#toArray(_readable);
    }

    #getNodeName(node, folder) {
        const suffix = node.key.slice(folder.length + 1)
        const i = suffix.indexOf('/')
        const name = i === -1 ? suffix : suffix.slice(0, i)
        const isFile = node.key.endsWith(name) && node.value;
        return { name, dir: !isFile ? name + '/' : null, pathname: join(folder, name, !isFile ? '/' : '') }
    }

    async #iteratorPeek(folder: string, prev: string, fileOnly = false) {
        let nodes = [null, null, false] as unknown as [Node, Node, /*skip:*/boolean];
        /** Yes two nodes in case a file and a folder have the same name*/
        const ite = this.files.createRangeIterator({
            gt: folder + prev,
            lt: folder + '0', limit: 2
        })
        try {
            await ite.open()
            nodes[0] = await ite.next()
            if (!fileOnly) {
                const next = await ite.next()
                if (next) {
                    if (next.key.startsWith(nodes[0].key)) nodes[1] = { seq: null, key: nodes[0].key + '/', value: null }
                }
            } else if (!nodes[0].value) nodes[2] = true;
        } finally {
            await ite.close()
        }
        return nodes;
    }

    async #mapper(item, { path = '', stat = false } = {}) {
        const self = this;
        let name: string;
        let pathname: string;
        if (typeof item == 'string') {
            name = item.replace(/(^\/)|(\/$)/g, '');
            pathname = join(path, item)
        } else {
            name = item.key.replace(/(^\/)|(\/$)/g, '').split('/').at(-1)
            pathname = item.key
        }
        const mapped = ({
            name,
            pathname
        })
        if (!stat) return mapped;
        mapped['stat'] = await self.stat(pathname);
        return mapped;
    };

    #shallowReadStream(folder: string, { nameOnly = false, fileOnly = false, stat = false } = {}) {
        const self = this;
        let prev = '/';
        return new Readable({
            async read(cb) {
                const [node, node2, skip] = await self.#iteratorPeek(folder, prev, fileOnly).catch(cb);

                if (skip) {
                    return cb(null);
                }

                if (!node) {
                    this.push(null);
                    return cb(null);
                }

                const { name, dir, pathname } = self.#getNodeName(node, folder);

                prev = '/' + name + '0';
                if (node2) {
                    this.push(!nameOnly ? await self.#mapper(node, { stat }) : name);
                    this.push(!nameOnly ? await self.#mapper({ key: join(pathname, '/') }, { stat }) : name + '/');
                }
                else {
                    this.push(!nameOnly ? await self.#mapper({ key: pathname }, { stat }) : dir || name);
                }
                cb(null);
            }
        })
    }

    async exists(path: fs.PathLike) {
        return !!(await this.entry(path) || (await this.#toArray(super.readdir(path))).length)
    }

    #list(folder: string, { fileOnly = false, stat = false } = {}) {
        folder = folder.replace(/\/$/, '');
        let dirs = [];
        const self = this;
        return pipeline(
            this.entries({
                gt: folder + '/', lt: folder + '0'
            }),
            new Transform({
                transform(node: Node, callback) {
                    if (!fileOnly) dirs = [...new Set([...dirs, ...self.getDirs(node.key)])]
                    self.#mapper(node, { stat }).then((node) => {
                        this.push(node)
                    }).finally(callback);
                },
                flush(callback) {
                    dirs.forEach((dir) => {
                        self.#mapper({ key: dir }, { stat }).then((node) => {
                            this.push(node)
                        }).finally(callback);
                    })
                }
            }))
    }

    override async list(path: string, { recursive = true, stat = false, fileOnly = false, readable = false } = {}) {
        let _readable: Readable;
        if (recursive) {
            _readable = this.#list(path, { stat, fileOnly })
        } else {
            _readable = this.readdir(path, { stat, fileOnly, readable: true })
        }
        if (readable) return _readable;
        return await this.#toArray(_readable);
    }

    async #toArray<F extends (item: any) => Promise<any>>(read: Readable, mapper?: F) {
        const items = []
        for await (const item of read) items.push(mapper ? await mapper(item) : item);
        return items
    }

    async stat(path: string) {
        const entry = await this.entry(path)
        const stat = (await this.stats.get(path))?.value;
        if (!entry) {
            const itemsCount = (await this.readdir(path, { readable: false })).length
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
        for (const dir of await this.getDirs(path)) {
            await this.#setStat(dir, { method, recursive: false })
        }
    }

    override async del(path: string, resolveStats = true) {
        path = path.replace(/\/$/, '');
        const file = await super.del(path);
        await this.stats.del(path);
        if (resolveStats) await this.#resolveDirStats(path as string);
        return file;
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
    getDirs(path: string) {
        path = path.replace(/\/$/, '');
        const paths = path.split('/');
        const dirs: string[] = [];
        for (let i = 0; i <= paths.length; i++) {
            if (!paths[i + 2]) break;
            const lastDir: string = (dirs.at(-1) || paths[i])
            dirs.push(join('/', lastDir, paths[i + 1], '/'))
        }
        return dirs;
    }

    async write(path: string, content, encoding) {
        await this.put(path, Buffer.from(content, encoding));
    }

    override async put(path: string, blob: Buffer, opts?) {
        path = path.replace(/\/$/, '');
        await this.#resolveDirStats(path);
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
