import hyperdrive from 'hyperdrive';
import { join } from 'path';
class Hyperdrive extends hyperdrive {
    constructor(store, dkey = undefined) {
        if (dkey && !Buffer.isBuffer(dkey))
            dkey = Buffer.from(dkey, 'hex');
        super(store, dkey);
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
        return !!(this.entry(path) ?? (await this.toArray(this.list(path))).length);
    }
    async ls(path, stat = true) {
        const files = [];
        const This = this;
        for await (const item of this.readdir(path))
            files.push({
                name: item,
                pathname: join(path, item),
                stat: stat ? await This.stat(join(path, item)) : {}
            });
        return files;
    }
    async toArray(read) {
        const items = [];
        for await (const item of read)
            items.push(item);
        return items;
    }
    async stat(path) {
        const entry = await this.entry(path);
        if (!entry) {
            const items = (await this.toArray(this.readdir(path))).length;
            if (!items)
                throw ('Path does not exist');
            return {
                isDirectory: () => true,
                items
            };
        }
        return {
            ...(entry.value.blob || {}), ...(entry.value.metadata || {}),
            key: entry.key, seq: entry.seq, executable: entry.value.executable, linkname: entry.value.linkname,
            isDirectory: () => !entry.value.blob
        };
        // #revist required
    }
    // async mkdir(path: fs.PathLike) {
    //     await this.put(path, Buffer.from(''), {metadata: {directory: true}})
    // }
    async rmdir(path) {
        // await this.del(join(path as string, '/'))
        // #revist required
    }
    async _sort(list, { sorting, ordering }) {
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
    async write(file, content, encoding) {
        await this.put(file, Buffer.from(content, encoding));
    }
    async read(file, encoding) {
        const content = await this.get(file);
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
