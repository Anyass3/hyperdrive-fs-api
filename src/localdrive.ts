
import { Readable, Writable } from 'streamx';
import * as fsp from 'fs/promises';
import * as fs from 'fs'
import { extname, resolve, join, basename, dirname } from 'path';
import { Item, ListOpts } from './typings';

type Files<S> = AsyncGenerator<Item<S> & { absolutePath: string }, any, Item<S> & { absolutePath: string }>
export class LocalDrive {
    root: string;
    fsp: typeof fsp;

    createReadStream: typeof fs.createReadStream;
    createWriteStream: typeof fs.createWriteStream;

    constructor(root = './') {
        this.root = root;
        this.#initFileStream()
    }

    resolvePath(path) {
        if (!path.startsWith(this.root)) {
            path = join(this.root, path)
        }
        return resolve(path);
    }

    async* filesGenerator<S extends boolean = false>(dirPath: string, { recursive = false, fileOnly = false, withStats = false, search = '' } = {} as Omit<ListOpts<S>, 'readable'>): Files<S> {
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
                if (!fileOnly && match) yield { path, absolutePath: this.resolvePath(path), name, ..._stats } as any;
                if (recursive) yield* await this.filesGenerator(path, { recursive, fileOnly, withStats, search }) as any;
            }
            else if (match) yield { path, absolutePath: this.resolvePath(path), name, ..._stats } as any;
        }
    }

    async list<S extends boolean = false>(path, opts: Omit<ListOpts<S>, 'readable'>) {
        const items = [] as (Item<S> & {
            absolutePath: string;
        })[]
        for await (const item of this.filesGenerator(path, opts)) items.push(item);
        return items
    }

    #initFileStream() {
        this.createReadStream = (path: string, opts: any) => {
            return fs.createReadStream(this.resolvePath(path), opts)
        }
        this.createWriteStream = (path: string, opts: any) => {
            return fs.createWriteStream(this.resolvePath(path), opts)
        }
    }

    createFolderReadStream(path) {
        const self = this;
        type F = Record<'path' | 'name', string>
        const files: AsyncGenerator<F, F, F> = this.filesGenerator(path, { fileOnly: true, recursive: true } as ListOpts)
        return new Readable({
            async read(cb) {
                const { done, value } = await files.next();
                if (done) {
                    this.push(null);
                    return cb(null);
                }
                const absolutePath = self.resolvePath(value.path)
                this.push({ path: absolutePath.slice(self.resolvePath(path).length), readable: fs.createReadStream(absolutePath) });
                return cb(null);
            }
        });
    }

    createFolderWriteStream(path: string) {
        const self = this;
        return new Writable<{ path: string, readable: Readable }>({
            async write(data, cb) {
                if (!data?.path || !data?.readable) {
                    return cb(null);
                }
                try {
                    const newFilepath = self.resolvePath(join(path, data.path));
                    await fsp.mkdir(dirname(newFilepath), { recursive: true })
                    const ws = fs.createWriteStream(newFilepath);
                    data.readable.pipe(ws);
                    data.readable.on('error', cb);
                    ws.on('close', cb);
                } catch (error) {
                    cb(error)
                }
            },
        })
    }
}