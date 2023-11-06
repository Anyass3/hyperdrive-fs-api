
import hyperdrive from 'hyperdrive';
import { join } from 'path';
import { Readable, Writable, pipelinePromise } from 'streamx';
import type HyperBee from 'hyperbee';
import type * as TT from './typings'
import { LocalDrive } from './localdrive.js';

class Hyperdrive extends hyperdrive {
    stats: HyperBee;
    local: LocalDrive;
    private _list: any;
    private _readdir: any;

    constructor(store, dkey?: string | Buffer | Record<string, any>, localDriveRoot?: string) {
        if (typeof dkey == 'string' && !Buffer.isBuffer(dkey)) dkey = Buffer.from(dkey, 'hex')
        super(store, dkey);

        this._readdir = super.readdir
        this._list = super.list

        this.stats = this.db.sub('stats', { keyEncoding: 'utf-8', valueEncoding: 'json' });
        this.local = new LocalDrive(localDriveRoot)
    }
    get peers() {
        return this.core.peers
    }
    get metadata() {
        return (this.core as any).metadata
    }
    get readable(): boolean {
        return this.core.readable
    }
    get writable(): boolean {
        return this.core.writable
    }
    // @ts-ignore
    override readdir<S extends boolean = false, B extends boolean = false, N extends boolean = false>(folder = '/', { withStats = false, nameOnly = false, fileOnly = false, readable = false, search = '' } = {} as TT.ReadDirOpts<S, B, N>): TT.ReadDir<S, B, N> {
        if (readable) return this.#shallowReadStream(folder, { nameOnly, fileOnly, withStats, search }) as any;
        return this.#toArray(this.#shallowReadGenerator(folder, { nameOnly, fileOnly, withStats, search })) as any;
    }

    override list<S extends boolean = false, B extends boolean = false>(folder: string, { recursive = true, withStats = false, fileOnly = false, readable = false, search = '' } = {} as TT.ListOpts<S, B>): TT.List<S, B> {
        if (!readable) {
            if (recursive) return this.#toArray<TT.Item<S>>(this.#listGenerator(folder, { withStats, fileOnly, search })) as any;
            return this.#toArray<TT.Item<S>>(this.#shallowReadGenerator(folder, { withStats, fileOnly, search })) as any;
        }
        if (recursive) return this.#list(folder, { withStats, fileOnly, search }) as any;

        return this.readdir(folder, { withStats, fileOnly, readable: true, search }) as any;

    }

    async throwErrorOnExists(path: string, isDir = false) {
        if (isDir) {
            if ((await this.entry(path))) throw Error('File already exists: ' + path);
        }
        else if (await this.isDirectory(path)) {
            throw Error('Directory already exists: ' + path);
        }
        await this.getDirs(path, { resolve: true });
    }

    async write(path: string, content: any, encoding?: BufferEncoding) {
        return await this.put(path, Buffer.from(content, encoding));
    }

    override async put(path: string, blob: Buffer, { awaitStats = false, ...opts } = {} as {
        executable?: boolean;
        awaitStats?: boolean;
        metadata?: Record<string, any>;
    }) {
        path = path.replace(/\/$/, '');
        await this.throwErrorOnExists(path);
        const node = await super.put(path, blob, opts);
        await this.#await(async () => this.#setStat(path), awaitStats);
        return node as TT.Node;
    }

    async read(path: string, encoding?: BufferEncoding) {
        const content = await this.get(path);
        return content?.toString(encoding);
    }

    override async del(path: string, { awaitStats = false } = {}) {
        return this.#del(path, { resolveStats: true, awaitStats });
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
            await this.del(item.path);
        }
        await this.stats.del(path);
    }

    async copy(source: string, dest: string, { awaitStats = false } = {}) {
        let node = await this.entry(source)
        if (!node?.value.blob) throw Error('Source file does not exist: ' + source)
        await this.throwErrorOnExists(dest);
        // this.createReadStream(source).pipe(this.createWriteStream(dest));
        const id = await this.files.put(join('/', dest), { ...node }) as unknown as TT.Node;
        await this.#await(async () => this.#setStat(dest), awaitStats);
        return id
    }

    async move(source: string, dest: string, { awaitStats = false } = {}) {
        const node = await this.entry(source)
        if (!node?.value.blob) throw Error('Source file does not exist: ' + source);
        await this.throwErrorOnExists(dest);
        const newNode = await this.files.put(join('/', dest), { ...node.value });
        await this.del(source);
        await this.#await(async () => this.#setStat(dest), awaitStats);
        return newNode as unknown as TT.Node;
    }
    createWriteStream(path: string, opts?: { executable?: boolean; metadata?: any; }) {
        const ws = super.createWriteStream(path, opts)
        ws.on('finish', () => {
            this.#setStat(path)
        })
        return ws
    }

    createFolderReadStream(path: string) {
        const self = this;
        const files = this.#toGenerator(super.list(path, { recursive: true })) as unknown as AsyncGenerator<TT.Node, TT.Node, unknown>;
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
        })
    }

    createFolderWriteStream(path: string, { awaitStats = false } = {}) {
        const self = this;
        let checkedWritability = false;
        return new Writable<{ path: string, readable: Readable }>({
            async write(data, cb) {
                if (!data?.path || !data?.readable) {
                    return cb(null);
                }
                if (!checkedWritability)
                    try {
                        await self.throwErrorOnExists(path, true)
                        checkedWritability = true;
                    } catch (error) {
                        return cb(error);
                    };

                try {
                    await self.throwErrorOnExists(data.path)

                } catch (error) {
                    return cb(error);
                }

                data.path = join(path, data.path)
                const ws = self.createWriteStream(data.path);

                data.readable.pipe(ws);
                data.readable.on('error', cb);

                ws.on('finish', cb);
            },
        })
    }

    async isDirectory(path: string) {
        return Boolean(await this.#iteratorPeek(path.replace(/\/$/, ''), '/'));
    }

    async exists(path: string) {
        return !!(await this.entry(path) || (await this.isDirectory(path)));
    }

    async stat(path: string, { isDir } = {} as { isDir?: boolean }): Promise<TT.Stat> {
        path = path.replace(/\/$/, '');
        const entry = await this.entry(path)
        const stat = (await this.stats.get(path))?.value;
        if (!entry) {
            if (typeof isDir != 'boolean') isDir = await this.isDirectory(path);
            if (!isDir) throw Error('Path does not exist');
            return {
                ...(stat || {}),
                isDirectory: () => true,
                isFile: () => false,
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
    }

    async getDirs(path: string, { exclude = '', resolve = false } = {}) {
        path = path.replace(/\/$/, '');
        const paths = path.split('/');
        const dirs: string[] = [];
        for (let i = 0; i <= paths.length; i++) {
            if (!paths[i + 2]) break;
            const lastDir: string = (dirs.at(-1) || paths[i])
            const dir = join('/', lastDir, paths[i + 1])
            if (join('/', exclude) == dir) continue;
            if (resolve && await this.entry(dir)) throw Error('File already exists: ' + dir);
            dirs.push(dir);
        }
        return dirs;
    }

    async export(path = '/', localPath = './') {
        await pipelinePromise(this.createFolderReadStream(path), this.local.createFolderWriteStream(localPath))
    }

    async import(localPath = './', path = '/') {
        await pipelinePromise(this.local.createFolderReadStream(localPath), this.createFolderWriteStream(path))
    }

    async #del(path: string, { resolveStats = true, awaitStats = false }) {
        path = path.replace(/\/$/, '');
        const node = await super.del(path);
        await this.#await(async () => {
            await this.stats.del(path);
            if (resolveStats)
                await this.#resolveDirStats(path);
        }, awaitStats);
        return node as TT.Node;
    }

    async #await(fn: () => Promise<void>, wait = true) {
        if (!wait) return fn();
        await fn();
    }

    async #countReadable(read: Readable<TT.Node>) {
        let count = 0;
        for await (const _ of read) count++;
        return count;
    }

    #getNodeName(node: TT.Node, folder: string) {
        const suffix = node.key.slice(folder.length + 1)
        const i = suffix.indexOf('/')
        const name = i === -1 ? suffix : suffix.slice(0, i)
        // const isFile: boolean = node.key.endsWith(name)// && !!node.value;
        return { name, isDir: !node.key.endsWith(name) }
    }

    async #iteratorPeek(folder: string, prev: string) {
        let node: TT.Node | null = null;
        // let skip: boolean;
        const ite = this.files.createRangeIterator({
            gt: folder + prev,
            lt: folder + '0', limit: 1
        });
        try {
            await ite.open();
            node = await ite.next();
            // if (node && !node.value) skip = true;
        } finally {
            await ite.close();
        }
        return node// { node, skip };
    }

    async #mapper<S extends boolean = false>(key: string, {/* path = '',*/ withStats = false, isDir } = {} as { withStats?: boolean, isDir?: boolean }): Promise<TT.Item<S>> {
        const self = this;
        let name: string;
        // let pathname: string;
        // if (typeof item == 'string') {
        //     name = item.replace(/(^\/)|(\/$)/g, '');
        //     pathname = join(path, item)
        // } else {
        name = key.replace(/(^\/)|(\/$)/g, '').split('/').at(-1)
        // pathname = key
        // }
        const mapped = ({
            name,
            path: key
        });
        if (!withStats) return mapped as any;
        mapped['stat'] = await self.stat(key, { isDir });
        return mapped as any;
    }

    async *#shallowReadGenerator(folder: string, { nameOnly = false, fileOnly = false, withStats = false, search = '' } = {} as Omit<TT.ReadDirOpts, 'readable'>) {
        folder = folder.replace(/\/$/, '')
        let prev = '/';
        while (true) {
            const node = await this.#iteratorPeek(folder, prev);
            // if (skip) {
            //     continue;
            // }
            if (!node) {
                break;
            }

            const { name, isDir } = this.#getNodeName(node, folder);

            prev = '/' + name + '0';

            if ((search && !name.match(search)) || (fileOnly && isDir)) {
                continue;
            }
            yield !nameOnly ? await this.#mapper(join(folder, name), { withStats, isDir }) : name;
        }

    }

    #shallowReadStream(folder: string, opts: Omit<TT.ReadDirOpts, 'readable'>) {
        return this.#generatorToReadable(this.#shallowReadGenerator(folder, opts))
    }

    async *#listGenerator(folder, { fileOnly = false, withStats = false, search = '' } = {} as Omit<TT.ListOpts, 'recursive' | 'readable'>) {
        folder = folder.replace(/\/$/, '');
        let dirs = []
        for await (const node of this.entries({
            gt: folder + '/', lt: folder + '0'
        }) as Readable<TT.Node>) {
            if (search && !node.key.match(search)) continue;
            if (!fileOnly) dirs = [...new Set([...dirs, ...await this.getDirs(node.key, { exclude: folder })])]
            const mappedNode = await this.#mapper(node.key, { withStats, isDir: false })
            if (!search || mappedNode.name.match(search)) yield mappedNode
        }
        if (fileOnly) return;
        //    yield* dirs.map(dir => ({ key: dir }))
        for (const dir of dirs) {
            yield await this.#mapper(dir, { withStats, isDir: true })
        }
    }

    #list(folder: string, opts: Omit<TT.ListOpts, 'recursive' | 'readable'>) {
        return this.#generatorToReadable(this.#listGenerator(folder, opts))
    }

    #generatorToReadable<T = unknown, TReturn = any, TNext = unknown>(readableGenerator: AsyncGenerator<T, TReturn, TNext>) {
        return new Readable({
            async read(cb) {
                try {
                    const { done, value } = await readableGenerator.next();
                    if (done) {
                        this.push(null);
                        return cb(null);
                    }
                    this.push(value)
                    cb(null);
                } catch (error) {
                    cb(error)
                }
            }
        })
    }

    async #toArray<T = any, MR = any, M extends ((item: T) => Promise<MR> | undefined) = any, RG extends Readable<T> | AsyncGenerator<T, T> = any>(read: RG, mapper?: M): Promise<M extends undefined ? T : MR> {
        const items = []
        for await (const item of read) items.push(mapper ? await mapper(item) : item);
        return items as any;
    }

    async *#toGenerator(read: Readable<TT.Node>) {
        for await (const item of read) yield item
    }

    async #resolveDirStats(path: string, method: 'modify' | 'change' = 'modify') {
        for (const dir of await this.getDirs(path)) {
            await this.#setStat(dir, { method, recursive: false })
        }
    }

    async #setStat(path: string, { method = 'create', extras = {}, recursive = true } = {} as { method?: 'access' | 'modify' | 'create' | 'change', extras?: Record<string, any>, recursive?: boolean }) {
        path = join('/', path.replace(/\/$/, ''));
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

}

export default Hyperdrive;
export { LocalDrive, Hyperdrive };