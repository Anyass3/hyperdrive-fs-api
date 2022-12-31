
import hyperdrive from 'hyperdrive';
import fs from 'fs';
import { join } from 'path';

class Hyperdrive extends hyperdrive {
    constructor(store, dkey = undefined) {
        if (dkey && !Buffer.isBuffer(dkey)) dkey = Buffer.from(dkey, 'hex')
        super(store, dkey);
    }
    get peers(): any[] {
        return this.core.peers
    }
    get metadata(): any {
        return //this.core.metadata
    }
    get closed(): any {
        return this.core.closed
    }
    get readable(): boolean {
        return this.core.readable
    }
    get writable(): boolean {
        return this.core.writable
    }
    async exists(path: fs.PathLike) {
        return !!this.entry(path)
    }
    async stat(path: fs.PathLike) {
        const entry = this.entry(path)
        if (!entry) return {};
        return { ...entry.blob, ...(entry?.metadata ?? {}) }
        // #revist required
    }
    async mkdir(path: fs.PathLike) {
        path = join(path as string, 'null')
        await this.put(path, Buffer.from(''))
        await this.del(path)
        // #revist required
    }
    async rmdir(path: fs.PathLike) {
        await this.del(join(path as string, '/'))
        // #revist required
    }
    async _sort(list, { sorting, ordering }) {
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
    async write(file, content, encoding) {
        await this.put(file, Buffer.from(content, encoding));

    }
    async read(file, encoding) {
        const content = await this.get(file);
        return content.toString(encoding)
    }
    async copy(source: string, dest: string) {

    }
    async export(drive_src = './', fs_dest = './') {

    }
    async import(fs_src = './', drive_dest = './') {

    }
}

export default Hyperdrive;
